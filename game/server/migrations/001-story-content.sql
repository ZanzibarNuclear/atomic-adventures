CREATE TABLE IF NOT EXISTS story_areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS story_beats (
  area_id TEXT NOT NULL REFERENCES story_areas(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  trigger_place TEXT,
  trigger_hex TEXT,
  trigger_room TEXT,
  trigger_exterior_node TEXT,
  trigger_event TEXT,
  trigger_flag TEXT,
  once_value INTEGER NOT NULL DEFAULT 1 CHECK (once_value IN (0, 1)),
  acknowledge INTEGER NOT NULL DEFAULT 1 CHECK (acknowledge IN (0, 1)),
  eyebrow TEXT,
  heading TEXT,
  text TEXT NOT NULL,
  revisit TEXT,
  require_all TEXT NOT NULL DEFAULT '[]',
  require_any TEXT NOT NULL DEFAULT '[]',
  require_not TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (area_id, id)
) STRICT;

CREATE TABLE IF NOT EXISTS story_choices (
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL,
  beat_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  sets_json TEXT NOT NULL DEFAULT '[]',
  set_flags_json TEXT NOT NULL DEFAULT '[]',
  go_hex TEXT,
  go_room TEXT,
  enter_building TEXT,
  FOREIGN KEY (area_id, beat_id)
    REFERENCES story_beats(area_id, id)
    ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS story_beats_order_idx
  ON story_beats(area_id, sort_order, id);
CREATE INDEX IF NOT EXISTS story_choices_order_idx
  ON story_choices(area_id, beat_id, sort_order);

CREATE TABLE IF NOT EXISTS story_revisions (
  id INTEGER PRIMARY KEY,
  area_id TEXT NOT NULL,
  beat_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'restore')),
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (area_id, beat_id, revision)
) STRICT;

CREATE TABLE IF NOT EXISTS content_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

INSERT OR IGNORE INTO content_meta(key, value)
VALUES ('story_revision', '0');
