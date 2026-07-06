import { transaction } from "./db.js";
import { ConflictError, NotFoundError, ValidationError } from "./story-repository.js";
import { applyHexRenames, changedWorldObjectIds, validateWorld } from "./world-model.js";
import { buildWorldCatalog } from "./world-catalog.js";
import { RevisionStore } from "./revision-store.js";
import { WorldDocumentStore } from "./world-document-store.js";
import { ContentReferenceService } from "./content-reference-service.js";

export const OUTDOOR_WORLD_ID = "outdoor-main";

export class WorldRepository {
  constructor(db, { seedWorld, buildingData, storyRepository = null, storylineRepository = null } = {}) {
    this.db = db;
    this.buildingData = buildingData;
    this.storyRepository = storyRepository;
    this.storylineRepository = storylineRepository;
    this.references = new ContentReferenceService({ storyRepository, storylineRepository });
    this.documents = new WorldDocumentStore(db, { kind: "outdoor" });
    this.revisions = new RevisionStore(db, {
      table: "world_revisions",
      idColumn: "world_id",
      metaKey: "world_revision",
    });
    if (seedWorld) this.ensureSeed(seedWorld);
  }

  setStoryRepository(repository) {
    this.storyRepository = repository;
    this.references.setStoryRepository(repository);
  }

  setStorylineRepository(repository) {
    this.storylineRepository = repository;
    this.references.setStorylineRepository(repository);
  }

  setBuildingData(buildingData) {
    this.buildingData = buildingData;
  }

  ensureSeed(seedWorld) {
    if (this.getDocument()) return;
    const validation = validateWorld(seedWorld);
    if (!validation.valid) throw new ValidationError(validation.errors);
    transaction(this.db, () => {
      this.documents.insert(OUTDOOR_WORLD_ID, validation.world);
      this.revisions.record(OUTDOOR_WORLD_ID, "import", validation.world);
      this.revisions.incrementGlobalRevision();
    });
  }

  getGlobalRevision() {
    return this.revisions.getGlobalRevision();
  }

  getDocument() {
    const row = this.documents.get(OUTDOOR_WORLD_ID);
    if (!row) return null;
    return {
      world: row.document,
      version: row.version,
      revision: this.getGlobalRevision(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getCatalog(buildingData = this.buildingData) {
    const document = this.getDocument();
    return buildWorldCatalog(document?.world ?? { hexes: [] }, buildingData);
  }

  validate(input) {
    return validateWorld(input);
  }

  previewHexRename(from, to, candidateWorld = null) {
    const document = this.getDocument();
    if (!document) throw new NotFoundError("Outdoor world not found.");
    const world = candidateWorld ?? document.world;
    return this.references.previewHexRename(world, from, to);
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
    const storyCheck = this.references.validateWorldReferences(nextCatalog, renames);
    if (Object.keys(storyCheck.errors).length) throw new ValidationError(storyCheck.errors);

    return transaction(this.db, () => {
      const storyResult = this.references.cascadeHexRenames(renames, nextCatalog);
      const nextVersion = existing.version + 1;
      this.documents.update(OUTDOOR_WORLD_ID, validation.world, nextVersion);
      this.revisions.record(OUTDOOR_WORLD_ID, "update", validation.world);
      const revision = this.revisions.incrementGlobalRevision();
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
    return this.revisions.list(OUTDOOR_WORLD_ID);
  }

  restore(revisionNumber) {
    const snapshot = this.revisions.getSnapshot(OUTDOOR_WORLD_ID, revisionNumber);
    if (!snapshot) throw new NotFoundError("World revision not found.");
    const validation = validateWorld(snapshot);
    if (!validation.valid) throw new ValidationError(validation.errors);
    const nextCatalog = buildWorldCatalog(validation.world, this.buildingData);
    const storyCheck = this.references.validateWorldReferences(nextCatalog);
    if (Object.keys(storyCheck.errors).length) throw new ValidationError(storyCheck.errors);
    const existing = this.getDocument();

    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.documents.update(OUTDOOR_WORLD_ID, validation.world, nextVersion);
      this.revisions.record(OUTDOOR_WORLD_ID, "restore", validation.world);
      const revision = this.revisions.incrementGlobalRevision();
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
    const storyCheck = this.references.validateWorldReferences(nextCatalog);
    if (Object.keys(storyCheck.errors).length) throw new ValidationError(storyCheck.errors);
    transaction(this.db, () => {
      if (existing) {
        this.documents.updateIncrementingVersion(OUTDOOR_WORLD_ID, validation.world);
      } else {
        this.documents.insert(OUTDOOR_WORLD_ID, validation.world);
      }
      this.revisions.record(OUTDOOR_WORLD_ID, "import", validation.world);
      this.revisions.incrementGlobalRevision();
    });
    this.storyRepository?.setWorld(nextCatalog);
    return this.getDocument();
  }

}
