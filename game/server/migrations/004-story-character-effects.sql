ALTER TABLE story_beats
  ADD COLUMN require_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE story_choices
  ADD COLUMN require_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE story_choices
  ADD COLUMN effects_json TEXT NOT NULL DEFAULT '[]';

UPDATE story_beats
SET require_json =
  '{"all":' || require_all || ',"any":' || require_any || ',"not":' || require_not || '}';
