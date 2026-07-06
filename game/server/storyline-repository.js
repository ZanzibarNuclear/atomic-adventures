import { transaction } from "./db.js";
import { ConflictError, NotFoundError, ValidationError } from "./story-repository.js";
import { RevisionStore } from "./revision-store.js";
import { validateStorylineDocument } from "./storyline-model.js";

export const STORYLINE_DOCUMENT_ID = "storyline-main";

export class StorylineRepository {
  constructor(db, {
    seedStoryline = null,
    storyRepository = null,
    worldRepository = null,
    characterRepository = null,
    learningRepository = null,
  } = {}) {
    this.db = db;
    this.storyRepository = storyRepository;
    this.worldRepository = worldRepository;
    this.characterRepository = characterRepository;
    this.learningRepository = learningRepository;
    this.revisions = new RevisionStore(db, {
      table: "storyline_revisions",
      idColumn: "storyline_id",
      metaKey: "storyline_revision",
    });
    if (seedStoryline) this.ensureSeed(seedStoryline);
  }

  setRepositories({
    storyRepository = this.storyRepository,
    worldRepository = this.worldRepository,
    characterRepository = this.characterRepository,
    learningRepository = this.learningRepository,
  } = {}) {
    this.storyRepository = storyRepository;
    this.worldRepository = worldRepository;
    this.characterRepository = characterRepository;
    this.learningRepository = learningRepository;
  }

  ensureSeed(seedStoryline) {
    if (this.getDocument()) return;
    const validation = this.validate(seedStoryline);
    if (!validation.valid) throw new ValidationError(validation.errors);
    transaction(this.db, () => {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO storyline_documents(id, document_json, version, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
      `).run(STORYLINE_DOCUMENT_ID, JSON.stringify(validation.storyline), now, now);
      this.revisions.record(STORYLINE_DOCUMENT_ID, "import", validation.storyline);
      this.revisions.incrementGlobalRevision();
    });
  }

  getGlobalRevision() {
    return this.revisions.getGlobalRevision();
  }

  getDocument() {
    const row = this.db.prepare(`
      SELECT document_json, version, created_at AS createdAt, updated_at AS updatedAt
      FROM storyline_documents WHERE id = ?
    `).get(STORYLINE_DOCUMENT_ID);
    if (!row) return null;
    return {
      storyline: JSON.parse(row.document_json),
      version: row.version,
      revision: this.getGlobalRevision(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getRuntimeStoryline() {
    const document = this.getDocument();
    return document ? {
      storyline: document.storyline,
      version: document.version,
      revision: document.revision,
      warnings: this.validate(document.storyline).warnings,
    } : null;
  }

  validate(input) {
    const building = this.worldRepository?.buildingData ?? null;
    return validateStorylineDocument(input, {
      story: this.storyRepository?.getRuntimeStory?.() ?? null,
      world: this.worldRepository?.getCatalog?.(building) ?? null,
      character: this.characterRepository?.getDocument?.()?.character ?? null,
      learning: this.learningRepository?.getDocument?.()?.learning ?? null,
    });
  }

  save(input, expectedVersion) {
    const existing = this.getDocument();
    if (!existing) throw new NotFoundError("Storyline content not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("Storyline content changed in another window.", existing);
    }
    const validation = this.validate(input);
    if (!validation.valid) throw new ValidationError(validation.errors);
    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE storyline_documents
        SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(validation.storyline),
        nextVersion,
        new Date().toISOString(),
        STORYLINE_DOCUMENT_ID,
      );
      this.revisions.record(STORYLINE_DOCUMENT_ID, "update", validation.storyline);
      const revision = this.revisions.incrementGlobalRevision();
      return {
        storyline: validation.storyline,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
      };
    });
  }

  listRevisions() {
    return this.revisions.list(STORYLINE_DOCUMENT_ID);
  }

  restore(revisionNumber) {
    const snapshot = this.revisions.getSnapshot(STORYLINE_DOCUMENT_ID, revisionNumber);
    if (!snapshot) throw new NotFoundError("Storyline revision not found.");
    const validation = this.validate(snapshot);
    if (!validation.valid) throw new ValidationError(validation.errors);
    const existing = this.getDocument();
    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE storyline_documents
        SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(validation.storyline),
        nextVersion,
        new Date().toISOString(),
        STORYLINE_DOCUMENT_ID,
      );
      this.revisions.record(STORYLINE_DOCUMENT_ID, "restore", validation.storyline);
      const revision = this.revisions.incrementGlobalRevision();
      return {
        storyline: validation.storyline,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
      };
    });
  }
}
