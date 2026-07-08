ALTER TABLE story_beats
  ADD COLUMN story_beat TEXT;

UPDATE story_beats
SET story_beat = storyline_step
WHERE story_beat IS NULL AND storyline_step IS NOT NULL;
