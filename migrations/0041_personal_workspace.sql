-- Private sidebar arrangement never grants conversation or installation access.
CREATE TABLE nook_personal_conversations(user TEXT NOT NULL,conversation TEXT NOT NULL,section TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user,conversation));
CREATE TABLE nook_personal_installations(user TEXT NOT NULL,origin TEXT NOT NULL,label TEXT NOT NULL,PRIMARY KEY(user,origin));
CREATE TRIGGER nook_personal_actor_deleted AFTER DELETE ON nook_actors BEGIN
 DELETE FROM nook_personal_conversations WHERE user=OLD.id;
 DELETE FROM nook_personal_installations WHERE user=OLD.id;
END;
CREATE TRIGGER nook_personal_conversation_deleted AFTER DELETE ON nook_conversations BEGIN DELETE FROM nook_personal_conversations WHERE conversation=OLD.id; END;
