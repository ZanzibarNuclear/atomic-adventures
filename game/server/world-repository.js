import { transaction } from "./db.js";
import { ConflictError, NotFoundError, ValidationError } from "./story-repository.js";
import { applyHexRenames, changedWorldObjectIds, validateWorld } from "./world-model.js";
import { buildWorldCatalog } from "./world-catalog.js";

export const OUTDOOR_WORLD_ID = "outdoor-main";

export class WorldRepository {
  constructor(db, { seedWorld, buildingData, storyRepository = null } = {}) {
    this.db = db;
    this.buildingData = buildingData;
    this.storyRepository = storyRepository;
    if (seedWorld) this.ensureSeed(seedWorld);
  }

  setStoryRepository(repository) {
    this.storyRepository = repository;
  }

  ensureSeed(seedWorld) {
    if (this.getDocument()) return;
    const validation = validateWorld(seedWorld);
    if (!validation.valid) throw new ValidationError(validation.errors);
    transaction(this.db, () => {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO world_documents(id, kind, document_json, version, created_at, updated_at)
        VALUES (?, 'outdoor', ?, 1, ?, ?)
      `).run(OUTDOOR_WORLD_ID, JSON.stringify(validation.world), now, now);
      this.#recordRevision("import", validation.world);
      this.#incrementGlobalRevision();
    });
  }

  getGlobalRevision() {
    return Number(
      this.db.prepare("SELECT value FROM content_meta WHERE key = 'world_revision'").get()?.value ?? 0,
    );
  }

  getDocument() {
    const row = this.db.prepare(`
      SELECT document_json, version, created_at AS createdAt, updated_at AS updatedAt
      FROM world_documents WHERE id = ?
    `).get(OUTDOOR_WORLD_ID);
    if (!row) return null;
    return {
      world: JSON.parse(row.document_json),
      version: row.version,
      revision: this.getGlobalRevision(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getCatalog() {
    const document = this.getDocument();
    return buildWorldCatalog(document?.world ?? { hexes: [] }, this.buildingData);
  }

  validate(input) {
    return validateWorld(input);
  }

  previewHexRename(from, to, candidateWorld = null) {
    const document = this.getDocument();
    if (!document) throw new NotFoundError("Outdoor world not found.");
    const world = candidateWorld ?? document.world;
    const references = [];
    if (world.start === from) references.push({ kind: "world", path: "start" });
    (world.journey ?? []).forEach((id, index) => {
      if (id === from) references.push({ kind: "world", path: `journey.${index}` });
    });
    (world.routes ?? []).forEach((route, routeIndex) => {
      (route.points ?? []).forEach((point, pointIndex) => {
        if (point.hex === from) {
          references.push({ kind: "world", path: `routes.${routeIndex}.points.${pointIndex}.hex` });
        }
      });
    });
    (world.features ?? []).forEach((feature, featureIndex) => {
      if (feature.hex === from) references.push({ kind: "world", path: `features.${featureIndex}.hex` });
      for (const key of ["at", "labelAt", "boothAt"]) {
        if (feature[key]?.hex === from) {
          references.push({ kind: "world", path: `features.${featureIndex}.${key}.hex` });
        }
      }
      (feature.points ?? []).forEach((point, pointIndex) => {
        if (point.hex === from) {
          references.push({ kind: "world", path: `features.${featureIndex}.points.${pointIndex}.hex` });
        }
      });
    });
    references.push(...(this.storyRepository?.findHexReferences(from) ?? []));
    return { from, to, references };
  }

  save(input, expectedVersion, renames = []) {
    const existing = this.getDocument();
    if (!existing) throw new NotFoundError("Outdoor world not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("The world changed in another window.", existing);
    }
    const candidate = applyHexRenames(structuredClone(input), renames);
    const validation = validateWorld(candidate);
    if (!validation.valid) throw new ValidationError(validation.errors);
    const nextCatalog = buildWorldCatalog(validation.world, this.buildingData);
    const storyCheck = this.storyRepository?.validateAgainstWorld(nextCatalog, renames) ?? { errors: {} };
    if (Object.keys(storyCheck.errors).length) throw new ValidationError(storyCheck.errors);

    return transaction(this.db, () => {
      const storyResult = this.storyRepository?.cascadeHexRenames(renames, nextCatalog) ?? {
        affected: [],
        revision: this.storyRepository?.getGlobalRevision?.() ?? 0,
      };
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE world_documents
        SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(validation.world), nextVersion, new Date().toISOString(), OUTDOOR_WORLD_ID);
      this.#recordRevision("update", validation.world);
      const revision = this.#incrementGlobalRevision();
      return {
        world: validation.world,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
        changedObjectIds: changedWorldObjectIds(existing.world, validation.world),
        story: storyResult,
      };
    });
  }

  listRevisions() {
    return this.db.prepare(`
      SELECT revision, operation, created_at AS createdAt
      FROM world_revisions
      WHERE world_id = ?
      ORDER BY revision DESC
    `).all(OUTDOOR_WORLD_ID);
  }

  restore(revisionNumber) {
    const row = this.db.prepare(`
      SELECT snapshot_json FROM world_revisions
      WHERE world_id = ? AND revision = ?
    `).get(OUTDOOR_WORLD_ID, Number(revisionNumber));
    if (!row) throw new NotFoundError("World revision not found.");
    const snapshot = JSON.parse(row.snapshot_json);
    const validation = validateWorld(snapshot);
    if (!validation.valid) throw new ValidationError(validation.errors);
    const nextCatalog = buildWorldCatalog(validation.world, this.buildingData);
    const storyCheck = this.storyRepository?.validateAgainstWorld(nextCatalog) ?? { errors: {} };
    if (Object.keys(storyCheck.errors).length) throw new ValidationError(storyCheck.errors);
    const existing = this.getDocument();

    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE world_documents SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(validation.world), nextVersion, new Date().toISOString(), OUTDOOR_WORLD_ID);
      this.#recordRevision("restore", validation.world);
      const revision = this.#incrementGlobalRevision();
      return {
        world: validation.world,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
        changedObjectIds: changedWorldObjectIds(existing.world, validation.world),
      };
    });
  }

  importWorld(input, { replace = false } = {}) {
    const validation = validateWorld(input);
    if (!validation.valid) throw new ValidationError(validation.errors);
    const existing = this.getDocument();
    if (existing && !replace) {
      throw new ConflictError(`World "${OUTDOOR_WORLD_ID}" already exists. Use --replace to overwrite it.`);
    }
    const nextCatalog = buildWorldCatalog(validation.world, this.buildingData);
    const storyCheck = this.storyRepository?.validateAgainstWorld(nextCatalog) ?? { errors: {} };
    if (Object.keys(storyCheck.errors).length) throw new ValidationError(storyCheck.errors);
    transaction(this.db, () => {
      const now = new Date().toISOString();
      if (existing) {
        this.db.prepare(`
          UPDATE world_documents SET document_json = ?, version = version + 1, updated_at = ?
          WHERE id = ?
        `).run(JSON.stringify(validation.world), now, OUTDOOR_WORLD_ID);
      } else {
        this.db.prepare(`
          INSERT INTO world_documents(id, kind, document_json, version, created_at, updated_at)
          VALUES (?, 'outdoor', ?, 1, ?, ?)
        `).run(OUTDOOR_WORLD_ID, JSON.stringify(validation.world), now, now);
      }
      this.#recordRevision("import", validation.world);
      this.#incrementGlobalRevision();
    });
    this.storyRepository?.setWorld(nextCatalog);
    return this.getDocument();
  }

  #recordRevision(operation, snapshot) {
    const revision = Number(this.db.prepare(`
      SELECT COALESCE(MAX(revision), 0) + 1 AS next
      FROM world_revisions WHERE world_id = ?
    `).get(OUTDOOR_WORLD_ID).next);
    this.db.prepare(`
      INSERT INTO world_revisions(world_id, revision, operation, snapshot_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(OUTDOOR_WORLD_ID, revision, operation, JSON.stringify(snapshot), new Date().toISOString());
  }

  #incrementGlobalRevision() {
    const next = this.getGlobalRevision() + 1;
    this.db.prepare("UPDATE content_meta SET value = ? WHERE key = 'world_revision'").run(String(next));
    return next;
  }
}
