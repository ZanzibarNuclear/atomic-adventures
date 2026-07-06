ALTER TABLE story_beats
  ADD COLUMN modes_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE story_beats
  ADD COLUMN storyline_step TEXT;
