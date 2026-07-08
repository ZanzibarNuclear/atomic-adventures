CREATE TABLE IF NOT EXISTS storyline_documents (
  id TEXT PRIMARY KEY,
  document_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS storyline_revisions (
  id INTEGER PRIMARY KEY,
  storyline_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('import', 'update', 'restore')),
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (storyline_id, revision)
) STRICT;

INSERT OR IGNORE INTO content_meta(key, value)
VALUES ('storyline_revision', '0');
