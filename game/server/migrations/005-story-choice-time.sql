ALTER TABLE story_choices
  ADD COLUMN time_minutes REAL NOT NULL DEFAULT 0;

ALTER TABLE story_choices
  ADD COLUMN activity TEXT NOT NULL DEFAULT 'light';
