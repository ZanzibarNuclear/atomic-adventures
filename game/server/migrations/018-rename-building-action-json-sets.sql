UPDATE world_documents
SET document_json = replace(document_json, '"sets":', '"set_flags":')
WHERE instr(document_json, '"sets":') > 0;

UPDATE world_revisions
SET snapshot_json = replace(snapshot_json, '"sets":', '"set_flags":')
WHERE instr(snapshot_json, '"sets":') > 0;
