ALTER TABLE storyline_documents
  RENAME TO story_arc_documents;

ALTER TABLE storyline_revisions
  RENAME TO story_arc_revisions;

ALTER TABLE story_arc_revisions
  RENAME COLUMN storyline_id TO story_arc_id;

INSERT OR IGNORE INTO content_meta(key, value)
SELECT 'story_arc_revision', value
FROM content_meta
WHERE key = 'storyline_revision';

DELETE FROM content_meta
WHERE key = 'storyline_revision';
