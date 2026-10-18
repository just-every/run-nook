-- Broadcast audience snapshots are native-message state, never import effects.
CREATE TABLE nook_broadcast_policy(scope TEXT PRIMARY KEY,version INTEGER NOT NULL,level TEXT NOT NULL CHECK(level IN ('everyone','admins','selected','inherit')),everyone_channel TEXT);
CREATE TABLE nook_broadcast_people(scope TEXT NOT NULL,user TEXT NOT NULL,PRIMARY KEY(scope,user));
CREATE TABLE nook_broadcast_actions(id TEXT PRIMARY KEY,scope TEXT NOT NULL,version INTEGER NOT NULL,actor TEXT,level TEXT NOT NULL,people INTEGER NOT NULL,everyone_channel TEXT,created TEXT NOT NULL);
CREATE TABLE nook_broadcast_choices(user TEXT PRIMARY KEY,email INTEGER CHECK(email IN (0,1)),push INTEGER CHECK(push IN (0,1)),zone TEXT NOT NULL DEFAULT 'UTC',away INTEGER NOT NULL DEFAULT 0 CHECK(away IN (0,1)));
CREATE TABLE nook_broadcast_ignores(user TEXT NOT NULL,conversation TEXT NOT NULL,PRIMARY KEY(user,conversation));
CREATE TABLE nook_broadcast_presence(page TEXT NOT NULL,user TEXT NOT NULL,session TEXT NOT NULL,heartbeat INTEGER NOT NULL,PRIMARY KEY(session,page));
CREATE INDEX nook_broadcast_active ON nook_broadcast_presence(user,heartbeat);
CREATE TABLE nook_broadcasts(message TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('channel','here','everyone')),recipients INTEGER NOT NULL,quiet INTEGER NOT NULL,other_zones INTEGER NOT NULL);
CREATE TABLE nook_broadcast_recipients(message TEXT NOT NULL,user TEXT NOT NULL,PRIMARY KEY(message,user));
CREATE INDEX nook_broadcast_inbox ON nook_broadcast_recipients(user,message);
CREATE TRIGGER nook_broadcast_message_erased AFTER DELETE ON nook_messages BEGIN
 DELETE FROM nook_broadcast_recipients WHERE message=OLD.id;
 DELETE FROM nook_broadcasts WHERE message=OLD.id;
END;
CREATE TRIGGER nook_broadcast_session_deleted AFTER DELETE ON oa_sessions BEGIN DELETE FROM nook_broadcast_presence WHERE session=OLD.id; END;

-- Preserve pending delivery while adding the native broadcast reason.
DROP TRIGGER nook_push_device_delete;
DROP TRIGGER nook_push_read_insert;
DROP TRIGGER nook_push_read_update;
DROP TRIGGER nook_push_done;
CREATE TABLE nook_notify_queue_next(
 id TEXT PRIMARY KEY,dedupe TEXT NOT NULL UNIQUE,user TEXT NOT NULL,conversation TEXT NOT NULL,
 actor TEXT,message TEXT,outcome TEXT,
 reason TEXT NOT NULL CHECK(reason IN ('mention','urgent-request','commitment-proposal','commitment-revision','commitment-complete','direct-message','thread-follow','all-messages','broadcast')),
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
