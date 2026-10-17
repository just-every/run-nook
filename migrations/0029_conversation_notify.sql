-- Per-member web policy. Missing rows derive the conversation-kind default.
-- Mobile overrides need device classification and are not represented here.
CREATE TABLE nook_conversation_notify(
 user TEXT NOT NULL,conversation TEXT NOT NULL,
 level TEXT CHECK(level IS NULL OR level IN ('all','mentions','nothing')),
 threads TEXT NOT NULL DEFAULT 'followed' CHECK(threads IN ('all','followed')),
 PRIMARY KEY(user,conversation)
);
DROP TRIGGER nook_push_device_delete;
DROP TRIGGER nook_push_read_insert;
DROP TRIGGER nook_push_read_update;
DROP TRIGGER nook_push_done;
CREATE TABLE nook_notify_queue_next(
 id TEXT PRIMARY KEY,dedupe TEXT NOT NULL UNIQUE,user TEXT NOT NULL,conversation TEXT NOT NULL,
 actor TEXT,message TEXT,outcome TEXT,
 reason TEXT NOT NULL CHECK(reason IN ('mention','urgent-request','commitment-proposal','commitment-revision','commitment-complete','direct-message','thread-follow','all-messages')),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','retrying','sent','folded','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0,due INTEGER NOT NULL,error TEXT,email TEXT,token_hash TEXT,created INTEGER NOT NULL,updated INTEGER NOT NULL,
 channel TEXT NOT NULL DEFAULT 'email' CHECK(channel IN ('email','push')),device TEXT,event_seq INTEGER,attention TEXT,
 CHECK(channel='email' AND device IS NULL OR channel='push' AND device IS NOT NULL)
);
INSERT INTO nook_notify_queue_next SELECT * FROM nook_notify_queue;
DROP TABLE nook_notify_queue;
ALTER TABLE nook_notify_queue_next RENAME TO nook_notify_queue;
CREATE INDEX nook_notify_queue_due ON nook_notify_queue(channel,state,due);
CREATE INDEX nook_notify_queue_recipient ON nook_notify_queue(channel,user,conversation,device,state,updated);
CREATE INDEX nook_notify_queue_actor ON nook_notify_queue(actor,state,updated);
CREATE INDEX nook_notify_queue_token ON nook_notify_queue(token_hash);
CREATE TRIGGER nook_push_device_delete AFTER DELETE ON nook_push_devices BEGIN
 DELETE FROM nook_push_presence WHERE device=OLD.id;
 UPDATE nook_notify_queue SET state='cancelled',error='device-removed' WHERE channel='push' AND device=OLD.id AND state IN ('pending','retrying');
END;
CREATE TRIGGER nook_push_read_insert AFTER INSERT ON nook_reads BEGIN
 UPDATE nook_notify_queue SET state='cancelled',error='seen',updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND user=NEW.user AND conversation=NEW.conversation AND message IS NOT NULL AND event_seq<=NEW.seq AND state IN ('pending','retrying');
END;
CREATE TRIGGER nook_push_read_update AFTER UPDATE OF seq ON nook_reads BEGIN
 UPDATE nook_notify_queue SET state='cancelled',error='seen',updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND user=NEW.user AND conversation=NEW.conversation AND message IS NOT NULL AND event_seq<=NEW.seq AND state IN ('pending','retrying');
END;
CREATE TRIGGER nook_push_done AFTER UPDATE OF state ON nook_attention WHEN NEW.state='done' BEGIN
 UPDATE nook_notify_queue SET state='cancelled',error='seen',updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND attention=NEW.id AND state IN ('pending','retrying');
END;
