CREATE TABLE nook_schedules(
 id TEXT PRIMARY KEY,user TEXT NOT NULL,conversation TEXT NOT NULL REFERENCES nook_conversations(id),
 intent TEXT NOT NULL,definition TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),
 local_at TEXT NOT NULL,zone TEXT NOT NULL,recurrence TEXT NOT NULL CHECK(recurrence IN ('none','daily','weekdays','weekly','monthly')),end_date TEXT,
 next_due INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('active','paused','cancelled','complete','failed','needs-review')),
 version INTEGER NOT NULL,operator_version INTEGER NOT NULL,access_generation INTEGER NOT NULL,
 reason TEXT,created INTEGER NOT NULL,updated INTEGER NOT NULL,UNIQUE(user,intent)
);
CREATE INDEX nook_schedule_due ON nook_schedules(state,next_due);
CREATE INDEX nook_schedule_owner ON nook_schedules(user,id);
CREATE TABLE nook_schedule_occurrences(
 schedule TEXT NOT NULL REFERENCES nook_schedules(id) ON DELETE CASCADE,
 local_at TEXT NOT NULL,version INTEGER NOT NULL,due INTEGER NOT NULL,zone TEXT NOT NULL,
 message TEXT,state TEXT NOT NULL CHECK(state IN ('sent','failed','needs-review')),
 reason TEXT,completed INTEGER NOT NULL,PRIMARY KEY(schedule,local_at,version)
);
CREATE TABLE nook_schedule_files(
 schedule TEXT NOT NULL REFERENCES nook_schedules(id) ON DELETE CASCADE,attachment TEXT NOT NULL UNIQUE,
 position INTEGER NOT NULL CHECK(position>=0 AND position<5),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,
 sha256 TEXT NOT NULL,object_key TEXT NOT NULL UNIQUE,PRIMARY KEY(schedule,attachment),UNIQUE(schedule,position)
);
CREATE TRIGGER nook_schedule_file_inventory_insert AFTER INSERT ON nook_schedule_files BEGIN INSERT OR IGNORE INTO nook_object_inventory VALUES(NEW.object_key); END;
CREATE TRIGGER nook_schedule_file_inventory_delete AFTER DELETE ON nook_schedule_files BEGIN DELETE FROM nook_object_inventory WHERE object_key=OLD.object_key AND NOT EXISTS(SELECT 1 FROM nook_schedule_files WHERE object_key=OLD.object_key) AND NOT EXISTS(SELECT 1 FROM nook_attachments WHERE object_key=OLD.object_key) AND NOT EXISTS(SELECT 1 FROM nook_import_uploads WHERE object_key=OLD.object_key AND state='ready') AND NOT EXISTS(SELECT 1 FROM nook_import_objects WHERE object_key=OLD.object_key AND state='ready'); END;
-- Schedule templates are a new durable owner of a private object. Existing
-- upload triggers must not drop their inventory during later tombstone erasure.
DROP TRIGGER nook_attachments_inventory_update;
CREATE TRIGGER nook_attachments_inventory_update AFTER UPDATE ON nook_attachments BEGIN DELETE FROM nook_object_inventory WHERE object_key=OLD.object_key AND NOT EXISTS(SELECT 1 FROM nook_attachments WHERE object_key=OLD.object_key) AND NOT EXISTS(SELECT 1 FROM nook_schedule_files WHERE object_key=OLD.object_key) AND NOT EXISTS(SELECT 1 FROM nook_import_uploads WHERE object_key=OLD.object_key AND state='ready') AND NOT EXISTS(SELECT 1 FROM nook_import_objects WHERE object_key=OLD.object_key AND state='ready'); INSERT OR IGNORE INTO nook_object_inventory SELECT NEW.object_key WHERE NEW.object_key IS NOT NULL; END;
DROP TRIGGER nook_attachments_inventory_delete;
CREATE TRIGGER nook_attachments_inventory_delete AFTER DELETE ON nook_attachments BEGIN DELETE FROM nook_object_inventory WHERE object_key=OLD.object_key AND NOT EXISTS(SELECT 1 FROM nook_attachments WHERE object_key=OLD.object_key) AND NOT EXISTS(SELECT 1 FROM nook_schedule_files WHERE object_key=OLD.object_key) AND NOT EXISTS(SELECT 1 FROM nook_import_uploads WHERE object_key=OLD.object_key AND state='ready') AND NOT EXISTS(SELECT 1 FROM nook_import_objects WHERE object_key=OLD.object_key AND state='ready'); END;
