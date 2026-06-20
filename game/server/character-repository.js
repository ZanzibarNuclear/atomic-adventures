import { transaction } from "./db.js";
import { ConflictError, NotFoundError, ValidationError } from "./story-repository.js";
import { validateCharacterDocument } from "./character-model.js";

export const CHARACTER_DOCUMENT_ID = "character-main";

export class CharacterRepository {
  constructor(db, { seedCharacter } = {}) {
    this.db = db;
    this.integrationValidator = null;
    if (seedCharacter) this.ensureSeed(seedCharacter);
  }

  setIntegrationValidator(validator) {
    this.integrationValidator = validator;
  }

  ensureSeed(seedCharacter) {
    if (this.getDocument()) return;
    const validation = this.validate(seedCharacter);
    if (!validation.valid) throw new ValidationError(validation.errors);
    transaction(this.db, () => {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO character_documents(id, document_json, version, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
      `).run(CHARACTER_DOCUMENT_ID, JSON.stringify(validation.character), now, now);
      this.#recordRevision("import", validation.character);
      this.#incrementGlobalRevision();
    });
  }

  getGlobalRevision() {
    return Number(
      this.db.prepare("SELECT value FROM content_meta WHERE key = 'character_revision'").get()?.value ?? 0,
    );
  }

  getDocument() {
    const row = this.db.prepare(`
      SELECT document_json, version, created_at AS createdAt, updated_at AS updatedAt
      FROM character_documents WHERE id = ?
    `).get(CHARACTER_DOCUMENT_ID);
    if (!row) return null;
    return {
      character: JSON.parse(row.document_json),
      version: row.version,
      revision: this.getGlobalRevision(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getRuntimeCharacter() {
    const document = this.getDocument();
    return document ? {
      character: document.character,
      version: document.version,
      revision: document.revision,
    } : null;
  }

  validate(input) {
    const result = validateCharacterDocument(input);
    if (!result.valid || !this.integrationValidator) return result;
    const integration = this.integrationValidator(result.character);
    const errors = { ...result.errors, ...(integration.errors ?? {}) };
    return {
      ...result,
      errors,
      warnings: [...result.warnings, ...(integration.warnings ?? [])],
      valid: integration.valid !== false && Object.keys(errors).length === 0,
    };
  }

  save(input, expectedVersion) {
    const existing = this.getDocument();
    if (!existing) throw new NotFoundError("Character content not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("Character content changed in another window.", existing);
    }
    const validation = this.validate(input);
    if (!validation.valid) throw new ValidationError(validation.errors);
    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE character_documents
        SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(validation.character),
        nextVersion,
        new Date().toISOString(),
        CHARACTER_DOCUMENT_ID,
      );
      this.#recordRevision("update", validation.character);
      const revision = this.#incrementGlobalRevision();
      return {
        character: validation.character,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
      };
    });
  }

  listRevisions() {
    return this.db.prepare(`
      SELECT revision, operation, created_at AS createdAt
      FROM character_revisions
      WHERE character_id = ?
      ORDER BY revision DESC
    `).all(CHARACTER_DOCUMENT_ID);
  }

  restore(revisionNumber) {
    const row = this.db.prepare(`
      SELECT snapshot_json FROM character_revisions
      WHERE character_id = ? AND revision = ?
    `).get(CHARACTER_DOCUMENT_ID, Number(revisionNumber));
    if (!row) throw new NotFoundError("Character revision not found.");
    const validation = this.validate(JSON.parse(row.snapshot_json));
    if (!validation.valid) throw new ValidationError(validation.errors);
    const existing = this.getDocument();
    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE character_documents
        SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(validation.character),
        nextVersion,
        new Date().toISOString(),
        CHARACTER_DOCUMENT_ID,
      );
      this.#recordRevision("restore", validation.character);
      const revision = this.#incrementGlobalRevision();
      return {
        character: validation.character,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
      };
    });
  }

  #recordRevision(operation, snapshot) {
    const revision = Number(this.db.prepare(`
      SELECT COALESCE(MAX(revision), 0) + 1 AS next
      FROM character_revisions WHERE character_id = ?
    `).get(CHARACTER_DOCUMENT_ID).next);
    this.db.prepare(`
      INSERT INTO character_revisions(
        character_id, revision, operation, snapshot_json, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      CHARACTER_DOCUMENT_ID,
      revision,
      operation,
      JSON.stringify(snapshot),
      new Date().toISOString(),
    );
  }

  #incrementGlobalRevision() {
    const next = this.getGlobalRevision() + 1;
    this.db.prepare(
      "UPDATE content_meta SET value = ? WHERE key = 'character_revision'",
    ).run(String(next));
    return next;
  }
}
