import { transaction } from "./db.js";
import { ConflictError, NotFoundError, ValidationError } from "./story-repository.js";
import { validateLearningDocument } from "./learning-model.js";
import { RevisionStore } from "./revision-store.js";

export const LEARNING_DOCUMENT_ID = "learning-main";

export class LearningRepository {
  constructor(db, { seedLearning, characterRepository = null } = {}) {
    this.db = db;
    this.characterRepository = characterRepository;
    this.revisions = new RevisionStore(db, {
      table: "learning_revisions",
      idColumn: "learning_id",
      metaKey: "learning_revision",
    });
    if (seedLearning) this.ensureSeed(seedLearning);
  }

  setCharacterRepository(characterRepository) {
    this.characterRepository = characterRepository;
  }

  ensureSeed(seedLearning) {
    if (this.getDocument()) return;
    const validation = this.validate(seedLearning);
    if (!validation.valid) throw new ValidationError(validation.errors);
    transaction(this.db, () => {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO learning_documents(id, document_json, version, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
      `).run(LEARNING_DOCUMENT_ID, JSON.stringify(validation.learning), now, now);
      this.revisions.record(LEARNING_DOCUMENT_ID, "import", validation.learning);
      this.revisions.incrementGlobalRevision();
    });
  }

  getGlobalRevision() {
    return this.revisions.getGlobalRevision();
  }

  getDocument() {
    const row = this.db.prepare(`
      SELECT document_json, version, created_at AS createdAt, updated_at AS updatedAt
      FROM learning_documents WHERE id = ?
    `).get(LEARNING_DOCUMENT_ID);
    if (!row) return null;
    return {
      learning: JSON.parse(row.document_json),
      version: row.version,
      revision: this.getGlobalRevision(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getRuntimeLearning() {
    const document = this.getDocument();
    return document ? {
      learning: document.learning,
      version: document.version,
      revision: document.revision,
    } : null;
  }

  validate(input) {
    return validateLearningDocument(input, {
      character: this.characterRepository?.getDocument()?.character ?? null,
    });
  }

  save(input, expectedVersion) {
    const existing = this.getDocument();
    if (!existing) throw new NotFoundError("Learning content not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("Learning content changed in another window.", existing);
    }
    const validation = this.validate(input);
    if (!validation.valid) throw new ValidationError(validation.errors);
    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE learning_documents
        SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(validation.learning),
        nextVersion,
        new Date().toISOString(),
        LEARNING_DOCUMENT_ID,
      );
      this.revisions.record(LEARNING_DOCUMENT_ID, "update", validation.learning);
      const revision = this.revisions.incrementGlobalRevision();
      return {
        learning: validation.learning,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
      };
    });
  }

  listRevisions() {
    return this.revisions.list(LEARNING_DOCUMENT_ID);
  }

  restore(revisionNumber) {
    const snapshot = this.revisions.getSnapshot(LEARNING_DOCUMENT_ID, revisionNumber);
    if (!snapshot) throw new NotFoundError("Learning revision not found.");
    const validation = this.validate(snapshot);
    if (!validation.valid) throw new ValidationError(validation.errors);
    const existing = this.getDocument();
    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE learning_documents
        SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(validation.learning),
        nextVersion,
        new Date().toISOString(),
        LEARNING_DOCUMENT_ID,
      );
      this.revisions.record(LEARNING_DOCUMENT_ID, "restore", validation.learning);
      const revision = this.revisions.incrementGlobalRevision();
      return {
        learning: validation.learning,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
      };
    });
  }
}
