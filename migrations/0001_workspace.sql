-- D1 is authoritative. Every domain mutation atomically compares revision.
CREATE TABLE workspace (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 revision INTEGER NOT NULL CHECK (revision >= 0),
 document TEXT NOT NULL CHECK (json_valid(document)),
 schema_version INTEGER NOT NULL CHECK (schema_version = 1)
);
CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO schema_migrations VALUES(1, 'workspace-document-v1');
