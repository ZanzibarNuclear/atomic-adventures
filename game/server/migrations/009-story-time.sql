ALTER TABLE story_beats
  ADD COLUMN time_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE story_choices
  ADD COLUMN time_until_json TEXT NOT NULL DEFAULT '{}';
