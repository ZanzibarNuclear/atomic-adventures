export class WorldDocumentStore {
  constructor(db, { kind }) {
    this.db = db;
    this.kind = kind;
  }

  get(id) {
    const row = this.db.prepare(`
      SELECT document_json, version, created_at AS createdAt, updated_at AS updatedAt
      FROM world_documents WHERE id = ? AND kind = ?
    `).get(id, this.kind);
    if (!row) return null;
    return {
      document: JSON.parse(row.document_json),
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  insert(id, document, version = 1) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO world_documents(id, kind, document_json, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, this.kind, JSON.stringify(document), version, now, now);
  }

  update(id, document, version) {
    this.db.prepare(`
      UPDATE world_documents
      SET document_json = ?, version = ?, updated_at = ?
      WHERE id = ? AND kind = ?
    `).run(JSON.stringify(document), version, new Date().toISOString(), id, this.kind);
  }

  updateIncrementingVersion(id, document) {
    this.db.prepare(`
      UPDATE world_documents SET document_json = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND kind = ?
    `).run(JSON.stringify(document), new Date().toISOString(), id, this.kind);
  }
}
