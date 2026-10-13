-- Preserve v1 data and ledger; add private attachment lifecycle to the document.
CREATE TABLE workspace_v2 (
 id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL CHECK(revision>=0),
 document TEXT NOT NULL CHECK(json_valid(document)),schema_version INTEGER NOT NULL CHECK(schema_version=2)
);
INSERT INTO workspace_v2 SELECT id,revision,json_set(document,'$.schemaVersion',2,'$.attachments',json('[]')),2 FROM workspace;
-- substr strips SQLite's JSON subtype so the immutable payload stays a string.
UPDATE workspace_v2 SET document=json_set(document,'$.messages',json((SELECT coalesce(json_group_array(json(CASE WHEN json_extract(value,'$.payload')='[erased]' THEN value ELSE json_set(value,'$.payload',substr(json_set(json_extract(value,'$.payload'),'$.attachments',json('[]')),1)) END)),'[]') FROM json_each(document,'$.messages'))));
DROP TABLE workspace;
ALTER TABLE workspace_v2 RENAME TO workspace;
INSERT INTO schema_migrations VALUES(2,'private-attachments-v2');
