CREATE TABLE nook_digest_schedules(
 user TEXT PRIMARY KEY,enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),
 cadence TEXT NOT NULL CHECK(cadence IN('daily','weekly')),local_at TEXT NOT NULL,zone TEXT NOT NULL,
 delivery TEXT NOT NULL CHECK(delivery IN('app','email')),next_due INTEGER NOT NULL,
 version INTEGER NOT NULL,operator_version INTEGER NOT NULL,access_generation INTEGER NOT NULL,updated INTEGER NOT NULL
);
CREATE INDEX nook_digest_due ON nook_digest_schedules(enabled,next_due);
-- Receipts hold source IDs, hashes and quote offsets, never answer prose or text.
CREATE TABLE nook_digest_deliveries(
 id TEXT PRIMARY KEY,user TEXT NOT NULL,version INTEGER NOT NULL,local_at TEXT NOT NULL,due INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN('deferred','delivering','delivered','empty','failed','skipped')),
 reason TEXT,receipt TEXT CHECK(receipt IS NULL OR json_valid(receipt)),created INTEGER NOT NULL,updated INTEGER NOT NULL,
 UNIQUE(user,version,local_at)
);
CREATE TRIGGER nook_digest_message_delete BEFORE DELETE ON nook_messages BEGIN
 DELETE FROM nook_digest_deliveries WHERE EXISTS(SELECT 1 FROM json_each(receipt,'$.points') p WHERE json_extract(p.value,'$.id')='message:'||OLD.id);
END;
CREATE TRIGGER nook_digest_file_delete BEFORE DELETE ON nook_attachments BEGIN
 DELETE FROM nook_digest_deliveries WHERE EXISTS(SELECT 1 FROM json_each(receipt,'$.points') p WHERE json_extract(p.value,'$.id')='file:'||OLD.id);
END;
CREATE TRIGGER nook_digest_import_delete BEFORE DELETE ON nook_import_records BEGIN
 DELETE FROM nook_digest_deliveries WHERE EXISTS(SELECT 1 FROM json_each(receipt,'$.points') p WHERE json_extract(p.value,'$.id')='message:'||OLD.id);
END;
CREATE TRIGGER nook_digest_schedule_exit_insert AFTER INSERT ON nook_digest_schedules BEGIN INSERT INTO nook_exit_changes VALUES('',1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_digest_schedule_exit_update AFTER UPDATE ON nook_digest_schedules BEGIN INSERT INTO nook_exit_changes VALUES('',1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_digest_schedule_exit_delete AFTER DELETE ON nook_digest_schedules BEGIN INSERT INTO nook_exit_changes VALUES('',1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_digest_delivery_exit_insert AFTER INSERT ON nook_digest_deliveries BEGIN INSERT INTO nook_exit_changes VALUES('',1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_digest_delivery_exit_update AFTER UPDATE ON nook_digest_deliveries BEGIN INSERT INTO nook_exit_changes VALUES('',1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_digest_delivery_exit_delete AFTER DELETE ON nook_digest_deliveries BEGIN INSERT INTO nook_exit_changes VALUES('',1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
