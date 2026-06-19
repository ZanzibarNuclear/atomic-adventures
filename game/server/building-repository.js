import { transaction } from "./db.js";
import { ConflictError, NotFoundError, ValidationError } from "./story-repository.js";
import { buildWorldCatalog } from "./world-catalog.js";
import {
  changedBuildingObjectIds,
  applyBuildingRenames,
  validateBuilding,
} from "./building-model.js";

export const UTILITY_STATION_ID = "utility-station";

export class BuildingRepository {
  constructor(db, {
    seedBuilding,
    worldRepository = null,
    storyRepository = null,
  } = {}) {
    this.db = db;
    this.worldRepository = worldRepository;
    this.storyRepository = storyRepository;
    if (seedBuilding) this.ensureSeed(seedBuilding);
  }

  setRepositories({ worldRepository, storyRepository }) {
    this.worldRepository = worldRepository;
    this.storyRepository = storyRepository;
  }

  ensureSeed(seedBuilding) {
    if (this.getDocument(seedBuilding.id ?? UTILITY_STATION_ID)) return;
    const validation = this.validate(seedBuilding);
    if (!validation.valid) throw new ValidationError(validation.errors);
    transaction(this.db, () => {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO world_documents(id, kind, document_json, version, created_at, updated_at)
        VALUES (?, 'building', ?, 1, ?, ?)
      `).run(validation.building.id, JSON.stringify(validation.building), now, now);
      this.#recordRevision(validation.building.id, "import", validation.building);
      this.#incrementGlobalRevision();
    });
  }

  getGlobalRevision() {
    return Number(
      this.db.prepare("SELECT value FROM content_meta WHERE key = 'world_revision'").get()?.value ?? 0,
    );
  }

  getDocument(id = UTILITY_STATION_ID) {
    const row = this.db.prepare(`
      SELECT document_json, version, created_at AS createdAt, updated_at AS updatedAt
      FROM world_documents WHERE id = ? AND kind = 'building'
    `).get(id);
    if (!row) return null;
    return {
      building: JSON.parse(row.document_json),
      version: row.version,
      revision: this.getGlobalRevision(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  validate(input) {
    const outdoorHexIds = new Set(
      (this.worldRepository?.getDocument()?.world.hexes ?? []).map((hex) => hex.id),
    );
    return validateBuilding(input, { outdoorHexIds });
  }

  previewRename(id, kind, from, to, candidateBuilding = null) {
    const document = this.getDocument(id);
    if (!document) throw new NotFoundError("Building not found.");
    const references = this.storyRepository?.findBuildingReferences(kind, from) ?? [];
    return { kind, from, to, references, building: candidateBuilding ?? document.building };
  }

  save(id, input, expectedVersion, renames = []) {
    const existing = this.getDocument(id);
    if (!existing) throw new NotFoundError("Building not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("The building changed in another window.", existing);
    }
    const candidate = applyBuildingRenames(structuredClone(input), renames);
    const validation = this.validate(candidate);
    if (!validation.valid) throw new ValidationError(validation.errors);
    if (validation.building.id !== id) {
      throw new ValidationError({ id: ["Building IDs cannot be changed in this editor."] });
    }
    this.#validateStory(validation.building, renames);

    return transaction(this.db, () => {
      const nextCatalog = buildWorldCatalog(
        this.worldRepository.getDocument()?.world ?? { hexes: [] },
        validation.building,
      );
      const story = this.storyRepository?.cascadeBuildingRenames(renames, nextCatalog) ?? {
        affected: [],
        revision: this.storyRepository?.getGlobalRevision?.() ?? 0,
      };
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE world_documents
        SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ? AND kind = 'building'
      `).run(JSON.stringify(validation.building), nextVersion, new Date().toISOString(), id);
      this.#recordRevision(id, "update", validation.building);
      const revision = this.#incrementGlobalRevision();
      return {
        building: validation.building,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
        changedObjectIds: changedBuildingObjectIds(existing.building, validation.building),
        story,
      };
    });
  }

  listRevisions(id = UTILITY_STATION_ID) {
    return this.db.prepare(`
      SELECT revision, operation, created_at AS createdAt
      FROM world_revisions
      WHERE world_id = ?
      ORDER BY revision DESC
    `).all(id);
  }

  restore(id, revisionNumber) {
    const row = this.db.prepare(`
      SELECT snapshot_json FROM world_revisions
      WHERE world_id = ? AND revision = ?
    `).get(id, Number(revisionNumber));
    if (!row) throw new NotFoundError("Building revision not found.");
    const validation = this.validate(JSON.parse(row.snapshot_json));
    if (!validation.valid) throw new ValidationError(validation.errors);
    this.#validateStory(validation.building);
    const existing = this.getDocument(id);

    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE world_documents SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ? AND kind = 'building'
      `).run(JSON.stringify(validation.building), nextVersion, new Date().toISOString(), id);
      this.#recordRevision(id, "restore", validation.building);
      const revision = this.#incrementGlobalRevision();
      return {
        building: validation.building,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
        changedObjectIds: changedBuildingObjectIds(existing.building, validation.building),
      };
    });
  }

  importBuilding(input, { replace = false } = {}) {
    const validation = this.validate(input);
    if (!validation.valid) throw new ValidationError(validation.errors);
    const existing = this.getDocument(validation.building.id);
    if (existing && !replace) {
      throw new ConflictError(
        `Building "${validation.building.id}" already exists. Use --replace to overwrite it.`,
      );
    }
    this.#validateStory(validation.building);
    transaction(this.db, () => {
      const now = new Date().toISOString();
      if (existing) {
        this.db.prepare(`
          UPDATE world_documents SET document_json = ?, version = version + 1, updated_at = ?
          WHERE id = ? AND kind = 'building'
        `).run(JSON.stringify(validation.building), now, validation.building.id);
      } else {
        this.db.prepare(`
          INSERT INTO world_documents(id, kind, document_json, version, created_at, updated_at)
          VALUES (?, 'building', ?, 1, ?, ?)
        `).run(validation.building.id, JSON.stringify(validation.building), now, now);
      }
      this.#recordRevision(validation.building.id, "import", validation.building);
      this.#incrementGlobalRevision();
    });
    this.worldRepository?.setBuildingData(validation.building);
    this.storyRepository?.setWorld(
      buildWorldCatalog(
        this.worldRepository?.getDocument()?.world ?? { hexes: [] },
        validation.building,
      ),
    );
    return this.getDocument(validation.building.id);
  }

  #validateStory(building, renames = []) {
    if (!this.storyRepository || !this.worldRepository) return;
    const outdoor = this.worldRepository.getDocument()?.world ?? { hexes: [] };
    const catalog = buildWorldCatalog(outdoor, building);
    const result = this.storyRepository.validateAgainstWorld(catalog, renames);
    if (Object.keys(result.errors).length) throw new ValidationError(result.errors);
  }

  #recordRevision(id, operation, snapshot) {
    const revision = Number(this.db.prepare(`
      SELECT COALESCE(MAX(revision), 0) + 1 AS next
      FROM world_revisions WHERE world_id = ?
    `).get(id).next);
    this.db.prepare(`
      INSERT INTO world_revisions(world_id, revision, operation, snapshot_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, revision, operation, JSON.stringify(snapshot), new Date().toISOString());
  }

  #incrementGlobalRevision() {
    const next = this.getGlobalRevision() + 1;
    this.db.prepare("UPDATE content_meta SET value = ? WHERE key = 'world_revision'").run(String(next));
    return next;
  }
}
