UPDATE story_choices
SET set_flags_json = (
  SELECT json_group_array(value)
  FROM (
    SELECT value FROM json_each(story_choices.set_flags_json)
    UNION
    SELECT value FROM json_each(story_choices.sets_json)
  )
)
WHERE EXISTS (
  SELECT 1 FROM pragma_table_info('story_choices') WHERE name = 'sets_json'
);

ALTER TABLE story_choices
  DROP COLUMN sets_json;
