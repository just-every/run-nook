CREATE TABLE nook_file_policy(
 id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL CHECK(version>=0),
 max_bytes INTEGER NOT NULL CHECK(max_bytes BETWEEN 1 AND 26214400),
 blocked_json TEXT NOT NULL CHECK(json_valid(blocked_json) AND json_type(blocked_json)='array')
);
INSERT INTO nook_file_policy VALUES(1,0,26214400,'[]');
CREATE TRIGGER nook_exit_file_policy_update AFTER UPDATE ON nook_file_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_file_policy_delete AFTER DELETE ON nook_file_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
