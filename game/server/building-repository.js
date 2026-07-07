import { transaction } from "./db.js";
import { ConflictError, NotFoundError, ValidationError } from "./story-repository.js";
import { buildWorldCatalog } from "./world-catalog.js";
import {
  changedBuildingObjectIds,
  applyBuildingRenames,
  validateBuilding,
} from "./building-model.js";
import { RevisionStore } from "./revision-store.js";
import { WorldDocumentStore } from "./world-document-store.js";
import { ContentReferenceService } from "./content-reference-service.js";

export const UTILITY_STATION_ID = "utility-station";

export class BuildingRepository {
  constructor(db, {
    seedBuilding,
    worldRepository = null,
    storyRepository = null,
    storyArcRepository = null,
    characterRepository = null,
  } = {}) {
    this.db = db;
    this.worldRepository = worldRepository;
    this.storyRepository = storyRepository;
    this.storyArcRepository = storyArcRepository;
    this.characterRepository = characterRepository;
    this.references = new ContentReferenceService({ storyRepository, storyArcRepository });
    this.documents = new WorldDocumentStore(db, { kind: "building" });
    this.revisions = new RevisionStore(db, {
      table: "world_revisions",
      idColumn: "world_id",
      metaKey: "world_revision",
    });
    if (seedBuilding) this.ensureSeed(seedBuilding);
  }

  setRepositories({ worldRepository, storyRepository, storyArcRepository, characterRepository }) {
    this.worldRepository = worldRepository;
    this.storyRepository = storyRepository;
    this.storyArcRepository = storyArcRepository ?? this.storyArcRepository;
    this.characterRepository = characterRepository ?? this.characterRepository;
    this.references.setStoryRepository(storyRepository);
    this.references.setStoryArcRepository(this.storyArcRepository);
  }

  ensureSeed(seedBuilding) {
    if (this.getDocument(seedBuilding.id ?? UTILITY_STATION_ID)) return;
    const validation = this.validate(seedBuilding);
    if (!validation.valid) throw new ValidationError(validation.errors);
    transaction(this.db, () => {
      this.documents.insert(validation.building.id, validation.building);
      this.revisions.record(validation.building.id, "import", validation.building);
      this.revisions.incrementGlobalRevision();
    });
  }

  getGlobalRevision() {
    return this.revisions.getGlobalRevision();
  }

  getDocument(id = UTILITY_STATION_ID) {
    const row = this.documents.get(id);
    if (!row) return null;
    return {
      building: row.document,
      version: row.version,
      revision: this.getGlobalRevision(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  validate(input, { character = null } = {}) {
    const outdoorHexes = this.worldRepository?.getDocument()?.world.hexes ?? [];
    const outdoorHexIds = new Set(outdoorHexes.map((hex) => hex.id));
    const outdoorStandIdsByHex = Object.fromEntries(
      outdoorHexes.map((hex) => [
        hex.id,
        new Set((hex.stands ?? []).map((stand) => stand.id)),
      ]),
    );
    const characterDocument = character ?? this.characterRepository?.getDocument()?.character ?? null;
    const characterItemIds = new Set(
      (characterDocument?.items ?? []).map((item) => item.id),
    );
    return validateBuilding(input, {
      outdoorHexIds,
      outdoorStandIdsByHex,
      characterItemIds,
      character: characterDocument,
    });
  }

  findCharacterReferences(domain, id) {
    const building = this.getDocument()?.building;
    if (!building) return [];
    const references = [];
    if (domain === "items") {
      building.doors?.forEach((door, index) => {
        if (door.lock?.key === id) {
          references.push({
            kind: "building",
            buildingId: building.id,
            path: `doors.${index}.lock.key`,
          });
        }
      });
      building.pickups?.forEach((pickup, index) => {
        if (pickup.item === id) {
          references.push({
            kind: "building",
            buildingId: building.id,
            path: `pickups.${index}.item`,
          });
        }
      });
    }
    building.actions?.forEach((action, index) => {
      const value = action.require?.[domain];
      if (["stats", "skills", "quests"].includes(domain)) {
        (value ?? []).forEach((entry, entryIndex) => {
          if (entry?.id === id) {
            references.push({
              kind: "building",
              buildingId: building.id,
              path: `actions.${index}.require.${domain}.${entryIndex}`,
            });
          }
        });
      } else {
        const groups = Array.isArray(value) ? { all: value } : value ?? {};
        for (const group of ["all", "any", "not"]) {
          (groups[group] ?? []).forEach((entry, entryIndex) => {
            const entryId = typeof entry === "string" ? entry : entry?.id;
            if (entryId === id) {
              references.push({
                kind: "building",
                buildingId: building.id,
                path: `actions.${index}.require.${domain}.${group}.${entryIndex}`,
              });
            }
          });
        }
      }
      action.effects?.forEach((effect, effectIndex) => {
        if (characterEffectDomain(effect.op) === domain && effect.id === id) {
          references.push({
            kind: "building",
            buildingId: building.id,
            path: `actions.${index}.effects.${effectIndex}`,
          });
        }
      });
    });
    return references;
  }

  previewRename(id, kind, from, to, candidateBuilding = null) {
    const document = this.getDocument(id);
    if (!document) throw new NotFoundError("Building not found.");
    return this.references.previewBuildingRename(
      candidateBuilding ?? document.building,
      kind,
      from,
      to,
    );
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
      const story = this.references.cascadeBuildingRenames(renames, nextCatalog);
      const nextVersion = existing.version + 1;
      this.documents.update(id, validation.building, nextVersion);
      this.revisions.record(id, "update", validation.building);
      const revision = this.revisions.incrementGlobalRevision();
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
    return this.revisions.list(id);
  }

  restore(id, revisionNumber) {
    const snapshot = this.revisions.getSnapshot(id, revisionNumber);
    if (!snapshot) throw new NotFoundError("Building revision not found.");
    const validation = this.validate(snapshot);
    if (!validation.valid) throw new ValidationError(validation.errors);
    this.#validateStory(validation.building);
    const existing = this.getDocument(id);

    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.documents.update(id, validation.building, nextVersion);
      this.revisions.record(id, "restore", validation.building);
      const revision = this.revisions.incrementGlobalRevision();
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
      if (existing) {
        this.documents.updateIncrementingVersion(validation.building.id, validation.building);
      } else {
        this.documents.insert(validation.building.id, validation.building);
      }
      this.revisions.record(validation.building.id, "import", validation.building);
      this.revisions.incrementGlobalRevision();
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
    if (!this.worldRepository) return;
    const outdoor = this.worldRepository.getDocument()?.world ?? { hexes: [] };
    const catalog = buildWorldCatalog(outdoor, building);
    const result = this.references.validateWorldReferences(catalog, renames);
    if (Object.keys(result.errors).length) throw new ValidationError(result.errors);
  }

}

function characterEffectDomain(op) {
  const domain = String(op ?? "").split(".")[0];
  return domain === "item" ? "items"
    : domain === "stat" ? "stats"
      : domain === "skill" ? "skills"
        : domain === "quest" ? "quests"
          : domain === "document" ? "documents"
            : domain;
}
