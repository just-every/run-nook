-- Add immutable external history without changing applied migrations or event frontiers.
CREATE TABLE workspace_v4 (
 id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL CHECK(revision>=0),
 document TEXT NOT NULL CHECK(json_valid(document)),schema_version INTEGER NOT NULL CHECK(schema_version=4)
);
INSERT INTO workspace_v4 SELECT id,revision,json_set(document,'$.schemaVersion',4,'$.imports',json('[]')),4 FROM workspace;
DROP TABLE workspace;
ALTER TABLE workspace_v4 RENAME TO workspace;
INSERT INTO schema_migrations(version,name) VALUES(4,'immutable-imports-v4');
