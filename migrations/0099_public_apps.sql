-- Optional public capabilities belong to the existing explicit channel approval.
-- Credentials and replay receipts are operational state, never portable data.
CREATE TABLE nook_notification_capabilities(
 app TEXT PRIMARY KEY,read_messages INTEGER NOT NULL CHECK(read_messages IN (0,1)),
 act_as_installer INTEGER NOT NULL CHECK(act_as_installer IN (0,1)),signing TEXT
);
CREATE TABLE nook_notification_requests(app TEXT NOT NULL,key TEXT NOT NULL,PRIMARY KEY(app,key));
CREATE TRIGGER nook_notification_capability_exit AFTER UPDATE OF state,creator ON nook_notification_apps
 WHEN NEW.state<>'active' OR NEW.creator IS NULL BEGIN
 DELETE FROM nook_notification_secrets WHERE app=NEW.id AND EXISTS(SELECT 1 FROM nook_notification_capabilities WHERE app=NEW.id);
 DELETE FROM nook_notification_capabilities WHERE app=NEW.id;
 DELETE FROM nook_notification_requests WHERE app=NEW.id;
END;
CREATE TRIGGER nook_notification_capability_delete AFTER DELETE ON nook_notification_apps BEGIN
 DELETE FROM nook_notification_capabilities WHERE app=OLD.id;
 DELETE FROM nook_notification_requests WHERE app=OLD.id;
END;
