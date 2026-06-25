export class RevisionStore {
  constructor(db, { table, idColumn, idColumns = null, metaKey }) {
    this.db = db;
    this.table = table;
    this.idColumns = idColumns ?? [idColumn];
    this.metaKey = metaKey;
  }

  #ids(documentId) {
    return Array.isArray(documentId) ? documentId : [documentId];
  }

  #whereClause() {
    return this.idColumns.map((column) => `${column} = ?`).join(" AND ");
  }

  getGlobalRevision() {
    return Number(
      this.db.prepare("SELECT value FROM content_meta WHERE key = ?").get(this.metaKey)?.value ?? 0,
    );
  }

  incrementGlobalRevision() {
    const next = this.getGlobalRevision() + 1;
    this.db.prepare("UPDATE content_meta SET value = ? WHERE key = ?").run(String(next), this.metaKey);
    return next;
  }

  list(documentId) {
    return this.db.prepare(`
      SELECT revision, operation, created_at AS createdAt
      FROM ${this.table}
      WHERE ${this.#whereClause()}
      ORDER BY revision DESC
    `).all(...this.#ids(documentId));
  }

  getSnapshot(documentId, revisionNumber) {
    const row = this.db.prepare(`
      SELECT snapshot_json FROM ${this.table}
      WHERE ${this.#whereClause()} AND revision = ?
    `).get(...this.#ids(documentId), Number(revisionNumber));
    return row ? JSON.parse(row.snapshot_json) : null;
  }

  record(documentId, operation, snapshot) {
    const ids = this.#ids(documentId);
    const revision = Number(this.db.prepare(`
      SELECT COALESCE(MAX(revision), 0) + 1 AS next
      FROM ${this.table} WHERE ${this.#whereClause()}
    `).get(...ids).next);
    const columns = [...this.idColumns, "revision", "operation", "snapshot_json", "created_at"];
    const placeholders = columns.map(() => "?").join(", ");
    this.db.prepare(`
      INSERT INTO ${this.table}(${columns.join(", ")})
      VALUES (${placeholders})
    `).run(...ids, revision, operation, JSON.stringify(snapshot), new Date().toISOString());
    return revision;
  }
}
