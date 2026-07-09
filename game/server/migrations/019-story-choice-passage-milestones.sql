ALTER TABLE story_choices
ADD COLUMN grant_milestones_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE story_choices
ADD COLUMN open_passage TEXT;

ALTER TABLE story_choices
ADD COLUMN close_passage TEXT;

ALTER TABLE story_choices
ADD COLUMN cross_passage TEXT;
