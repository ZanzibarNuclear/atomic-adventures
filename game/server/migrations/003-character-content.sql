CREATE TABLE IF NOT EXISTS character_documents (
  id TEXT PRIMARY KEY,
  document_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS character_revisions (
  id INTEGER PRIMARY KEY,
  character_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('import', 'update', 'restore')),
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (character_id, revision)
) STRICT;

INSERT OR IGNORE INTO content_meta(key, value)
VALUES ('character_revision', '0');
