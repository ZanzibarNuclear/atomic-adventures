CREATE TABLE IF NOT EXISTS world_documents (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  document_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS world_revisions (
  id INTEGER PRIMARY KEY,
  world_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('import', 'update', 'restore')),
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (world_id, revision)
) STRICT;

INSERT OR IGNORE INTO content_meta(key, value)
VALUES ('world_revision', '0');
