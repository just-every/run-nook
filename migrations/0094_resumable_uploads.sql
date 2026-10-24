CREATE TABLE nook_multipart_uploads(attachment TEXT PRIMARY KEY,object_key TEXT NOT NULL UNIQUE,multipart_id TEXT,expires INTEGER NOT NULL);
CREATE TABLE nook_multipart_parts(attachment TEXT NOT NULL,part INTEGER NOT NULL CHECK(part>=1),size INTEGER NOT NULL CHECK(size>0),sha256 TEXT NOT NULL,etag TEXT NOT NULL,PRIMARY KEY(attachment,part));
CREATE TABLE nook_file_policy_large(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL CHECK(version>=0),max_bytes INTEGER NOT NULL CHECK(max_bytes BETWEEN 1 AND 1073741824),blocked_json TEXT NOT NULL CHECK(json_valid(blocked_json) AND json_type(blocked_json)='array'));
INSERT INTO nook_file_policy_large SELECT * FROM nook_file_policy;
DROP TABLE nook_file_policy;
ALTER TABLE nook_file_policy_large RENAME TO nook_file_policy;
CREATE TRIGGER nook_exit_file_policy_update AFTER UPDATE ON nook_file_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_file_policy_delete AFTER DELETE ON nook_file_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
