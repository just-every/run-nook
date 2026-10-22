-- NOOK-080: an approval is one app identity in one explicitly named channel.
-- App actors have no operator account, mailbox, session or human admission.
CREATE TABLE nook_notification_apps(
 id TEXT PRIMARY KEY,name TEXT NOT NULL,conversation TEXT NOT NULL,
 creator TEXT,created INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('active','revoked','removed','reissue')),ended INTEGER
);
CREATE UNIQUE INDEX nook_notification_active_name ON nook_notification_apps(name,conversation) WHERE state='active';
CREATE INDEX nook_notification_app_channel ON nook_notification_apps(conversation,state);
CREATE TABLE nook_notification_secrets(app TEXT PRIMARY KEY,hash TEXT NOT NULL);
CREATE TABLE nook_notification_rates(conversation TEXT PRIMARY KEY,balance INTEGER NOT NULL,updated INTEGER NOT NULL);
-- Unknown/changed federation is fail closed. Today's product has no shared-channel door.
CREATE TABLE nook_notification_sharing(conversation TEXT PRIMARY KEY,state TEXT NOT NULL CHECK(state IN ('local','shared','unknown')));
CREATE TRIGGER nook_notification_actor AFTER INSERT ON nook_notification_apps BEGIN
 INSERT OR IGNORE INTO nook_actors(id,name,email,role,active) VALUES(NEW.id,NEW.name,NULL,'app',0);
END;
-- Existing accounts have no historical address-bound proof to invent. A fresh
-- native confirmation establishes the exact mailbox; changing it clears proof.
CREATE TABLE nook_notification_email_facts(user TEXT PRIMARY KEY,email TEXT NOT NULL,verified_at INTEGER NOT NULL);
CREATE TRIGGER nook_notification_email_confirmed AFTER INSERT ON oa_sessions
 WHEN NEW.kind='native' AND NEW.source_token_id IS NOT NULL
BEGIN
 INSERT INTO nook_notification_email_facts SELECT NEW.operator_id,email,NEW.created_at FROM oa_operators WHERE id=NEW.operator_id
 ON CONFLICT(user) DO UPDATE SET email=excluded.email,verified_at=excluded.verified_at;
END;
CREATE TRIGGER nook_notification_email_changed AFTER UPDATE OF email ON oa_operators
 WHEN OLD.email<>NEW.email BEGIN DELETE FROM nook_notification_email_facts WHERE user=NEW.id; END;
CREATE TRIGGER nook_notification_exit_insert AFTER INSERT ON nook_notification_apps BEGIN INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_notification_exit_update AFTER UPDATE ON nook_notification_apps BEGIN INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_notification_exit_delete AFTER DELETE ON nook_notification_apps BEGIN INSERT INTO nook_exit_changes VALUES(OLD.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
