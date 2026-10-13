-- C15: preserve every existing email preference and queue row. Push starts off.
ALTER TABLE nook_notify_preferences ADD COLUMN push_mentions INTEGER NOT NULL DEFAULT 0 CHECK(push_mentions IN (0,1));
ALTER TABLE nook_notify_preferences ADD COLUMN push_urgent INTEGER NOT NULL DEFAULT 0 CHECK(push_urgent IN (0,1));
ALTER TABLE nook_notify_preferences ADD COLUMN push_urgent_quiet INTEGER NOT NULL DEFAULT 0 CHECK(push_urgent_quiet IN (0,1));
ALTER TABLE nook_notify_preferences ADD COLUMN push_direct INTEGER NOT NULL DEFAULT 0 CHECK(push_direct IN (0,1));
ALTER TABLE nook_notify_preferences ADD COLUMN push_threads INTEGER NOT NULL DEFAULT 0 CHECK(push_threads IN (0,1));
CREATE TABLE nook_push_secrets(id INTEGER PRIMARY KEY CHECK(id=1), public_key TEXT NOT NULL, sealed_private TEXT NOT NULL);
CREATE TABLE nook_push_devices(
 id TEXT PRIMARY KEY,user TEXT NOT NULL,session TEXT NOT NULL,version INTEGER NOT NULL,
 transport TEXT NOT NULL CHECK(transport='webpush'),endpoint_hash TEXT NOT NULL UNIQUE,
 subscription TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL
);
CREATE INDEX nook_push_devices_user ON nook_push_devices(user);
CREATE TABLE nook_push_presence(page TEXT PRIMARY KEY,device TEXT NOT NULL,user TEXT NOT NULL,session TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX nook_push_presence_user ON nook_push_presence(user,expires);
-- Widen only the queue's delivery channels/reasons; the C14 whitelist is unchanged.
CREATE TABLE nook_notify_queue_next(
 id TEXT PRIMARY KEY,dedupe TEXT NOT NULL UNIQUE,user TEXT NOT NULL,conversation TEXT NOT NULL,
 actor TEXT,message TEXT,outcome TEXT,
 reason TEXT NOT NULL CHECK(reason IN ('mention','urgent-request','commitment-proposal','commitment-revision','commitment-complete','direct-message','thread-follow')),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','retrying','sent','folded','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0,due INTEGER NOT NULL,error TEXT,email TEXT,token_hash TEXT,created INTEGER NOT NULL,updated INTEGER NOT NULL,
 channel TEXT NOT NULL DEFAULT 'email' CHECK(channel IN ('email','push')),device TEXT,event_seq INTEGER,attention TEXT,
 CHECK(channel='email' AND device IS NULL OR channel='push' AND device IS NOT NULL)
);
INSERT INTO nook_notify_queue_next(id,dedupe,user,conversation,actor,message,outcome,reason,state,attempts,due,error,email,token_hash,created,updated)
 SELECT id,dedupe,user,conversation,actor,message,outcome,reason,state,attempts,due,error,email,token_hash,created,updated FROM nook_notify_queue;
DROP TABLE nook_notify_queue;
ALTER TABLE nook_notify_queue_next RENAME TO nook_notify_queue;
CREATE INDEX nook_notify_queue_due ON nook_notify_queue(channel,state,due);
CREATE INDEX nook_notify_queue_recipient ON nook_notify_queue(channel,user,conversation,device,state,updated);
CREATE INDEX nook_notify_queue_actor ON nook_notify_queue(actor,state,updated);
CREATE INDEX nook_notify_queue_token ON nook_notify_queue(token_hash);
-- Device removal and account erasure also remove endpoint-linked delivery state.
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
CREATE TRIGGER nook_push_session_delete AFTER DELETE ON oa_sessions BEGIN
 DELETE FROM nook_push_devices WHERE session=OLD.id;
END;
CREATE TRIGGER nook_push_session_revoke AFTER UPDATE OF revoked_at ON oa_sessions WHEN NEW.revoked_at IS NOT NULL BEGIN
 DELETE FROM nook_push_devices WHERE session=NEW.id;
END;
CREATE TRIGGER nook_push_identity_revoke AFTER UPDATE OF version,status ON oa_operators WHEN NEW.version<>OLD.version OR NEW.status<>'active' BEGIN
 DELETE FROM nook_push_devices WHERE user=NEW.id;
END;
