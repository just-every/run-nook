-- Native schema3 maps root ledger5 attention; prior identities and erased markers remain.
CREATE TABLE workspace_v3 (
 id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL CHECK(revision>=0),
 document TEXT NOT NULL CHECK(json_valid(document)),schema_version INTEGER NOT NULL CHECK(schema_version=3)
);
INSERT INTO workspace_v3 SELECT id,revision,json_set(document,'$.schemaVersion',3,'$.preferences',json('[]'),'$.thread_follows',json('[]'),'$.user_settings',json('[]'),'$.attention',json('[]')),3 FROM workspace;
UPDATE workspace_v3 SET document=json_set(document,'$.messages',json((SELECT coalesce(json_group_array(json(CASE WHEN json_extract(value,'$.payload')='[erased]' THEN value ELSE json_set(value,'$.payload',substr(json_set(json_extract(value,'$.payload'),'$.mentions',json('[]'),'$.urgent',json('false'),'$.urgentReason',NULL),1)) END)),'[]') FROM json_each(document,'$.messages'))));
DROP TABLE workspace;
ALTER TABLE workspace_v3 RENAME TO workspace;
INSERT INTO schema_migrations VALUES(3,'calm-attention-v3');
