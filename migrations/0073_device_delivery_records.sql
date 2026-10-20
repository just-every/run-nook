-- NOOK-073. Held, released and canceled Web Push routing outcomes are retained
-- body-free records with their reasons. The live queue stays delivery state and
-- is pruned; the device delivery view remains a seven-day, latest-100 window.
-- Additive upgrade: every existing queue row is kept and existing routing
-- outcomes are copied before the triggers take over.
CREATE TABLE nook_push_delivery_records(
 id TEXT PRIMARY KEY,
 user TEXT NOT NULL,
 conversation TEXT NOT NULL,
 device TEXT NOT NULL,
 device_name TEXT NOT NULL,
 reason TEXT NOT NULL,
 state TEXT NOT NULL,
 error TEXT,
 created INTEGER NOT NULL,
 updated INTEGER NOT NULL,
 held_at INTEGER,
 released_at INTEGER
);
CREATE INDEX nook_push_delivery_records_user ON nook_push_delivery_records(user,created,id);
INSERT OR IGNORE INTO nook_push_delivery_records SELECT q.id,q.user,q.conversation,q.device,COALESCE((SELECT name FROM nook_push_devices WHERE id=q.device),'Removed device'),q.reason,q.state,q.error,q.created,q.updated,q.held_at,q.released_at FROM nook_notify_queue q WHERE q.channel='push' AND (q.held_at IS NOT NULL OR q.state='cancelled');
CREATE TRIGGER nook_push_delivery_record_insert AFTER INSERT ON nook_notify_queue WHEN NEW.channel='push' AND (NEW.held_at IS NOT NULL OR NEW.state='cancelled') BEGIN
 INSERT INTO nook_push_delivery_records VALUES(NEW.id,NEW.user,NEW.conversation,NEW.device,COALESCE((SELECT name FROM nook_push_devices WHERE id=NEW.device),'Removed device'),NEW.reason,NEW.state,NEW.error,NEW.created,NEW.updated,NEW.held_at,NEW.released_at)
 ON CONFLICT(id) DO UPDATE SET state=excluded.state,error=excluded.error,updated=excluded.updated,held_at=excluded.held_at,released_at=excluded.released_at;
END;
CREATE TRIGGER nook_push_delivery_record_update AFTER UPDATE ON nook_notify_queue WHEN NEW.channel='push' AND (NEW.held_at IS NOT NULL OR NEW.state='cancelled') BEGIN
 INSERT INTO nook_push_delivery_records VALUES(NEW.id,NEW.user,NEW.conversation,NEW.device,COALESCE((SELECT name FROM nook_push_devices WHERE id=NEW.device),'Removed device'),NEW.reason,NEW.state,NEW.error,NEW.created,NEW.updated,NEW.held_at,NEW.released_at)
 ON CONFLICT(id) DO UPDATE SET state=excluded.state,error=excluded.error,updated=excluded.updated,held_at=excluded.held_at,released_at=excluded.released_at;
END;
