-- Additive upgrade: existing devices, preferences and deliveries keep every row.
ALTER TABLE nook_push_presence ADD COLUMN last_input_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nook_push_devices ADD COLUMN name TEXT NOT NULL DEFAULT 'Web browser';
ALTER TABLE nook_notify_preferences ADD COLUMN mobile_when_active TEXT NOT NULL DEFAULT 'inactive' CHECK(mobile_when_active IN ('inactive','always'));
ALTER TABLE nook_notify_preferences ADD COLUMN mobile_delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK(mobile_delay_minutes IN (0,1,2,5,10,15,30));
ALTER TABLE nook_notify_queue ADD COLUMN held_at INTEGER;
ALTER TABLE nook_notify_queue ADD COLUMN active_until INTEGER;
ALTER TABLE nook_notify_queue ADD COLUMN released_at INTEGER;
ALTER TABLE nook_push_presence ADD COLUMN device_class TEXT NOT NULL DEFAULT 'desktop' CHECK(device_class IN ('desktop','mobile'));

DROP TRIGGER nook_push_read_insert;
DROP TRIGGER nook_push_read_update;
DROP TRIGGER nook_push_done;
CREATE TRIGGER nook_push_read_insert AFTER INSERT ON nook_reads BEGIN
 UPDATE nook_notify_queue SET state='cancelled',error=CASE WHEN held_at IS NOT NULL THEN 'held-active-elsewhere' ELSE 'seen' END,updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND user=NEW.user AND conversation=NEW.conversation AND message IS NOT NULL AND event_seq<=NEW.seq AND state IN ('pending','retrying');
END;
CREATE TRIGGER nook_push_read_update AFTER UPDATE OF seq ON nook_reads BEGIN
 UPDATE nook_notify_queue SET state='cancelled',error=CASE WHEN held_at IS NOT NULL THEN 'held-active-elsewhere' ELSE 'seen' END,updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND user=NEW.user AND conversation=NEW.conversation AND message IS NOT NULL AND event_seq<=NEW.seq AND state IN ('pending','retrying');
END;
CREATE TRIGGER nook_push_done AFTER UPDATE OF state ON nook_attention WHEN NEW.state='done' BEGIN
 UPDATE nook_notify_queue SET state='cancelled',error=CASE WHEN held_at IS NOT NULL THEN 'held-active-elsewhere' ELSE 'seen' END,updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND attention=NEW.id AND state IN ('pending','retrying');
END;
