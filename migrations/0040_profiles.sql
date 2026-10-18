CREATE TABLE nook_profiles(
 user TEXT PRIMARY KEY,presence_enabled INTEGER NOT NULL DEFAULT 1 CHECK(presence_enabled IN (0,1)),typing_enabled INTEGER NOT NULL DEFAULT 1 CHECK(typing_enabled IN (0,1)),zone TEXT NOT NULL DEFAULT 'UTC',
 status_emoji TEXT NOT NULL DEFAULT '',status_text TEXT NOT NULL DEFAULT '',status_expires INTEGER,
 version INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL
);
CREATE INDEX nook_profile_expiry ON nook_profiles(status_expires) WHERE status_expires IS NOT NULL;
CREATE TABLE nook_profile_fields(
 id TEXT PRIMARY KEY,label TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('text','phone','date')),
 visibility TEXT NOT NULL CHECK(visibility IN ('members','shared-conversation','admins','self')),
 position INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE nook_profile_values(user TEXT NOT NULL,field TEXT NOT NULL REFERENCES nook_profile_fields(id) ON DELETE CASCADE,value TEXT NOT NULL,PRIMARY KEY(user,field));
CREATE INDEX nook_profile_value_field ON nook_profile_values(field,user);
CREATE TABLE nook_profile_field_actions(id TEXT PRIMARY KEY,actor TEXT,created INTEGER NOT NULL,fields INTEGER NOT NULL);
INSERT INTO nook_profile_fields(id,label,type,visibility,position) VALUES
 ('title','Title','text','members',0),('department','Department','text','members',1),
 ('phone','Phone','phone','shared-conversation',2),('manager','Manager','text','members',3),
 ('location','Location','text','members',4),('pronouns','Pronouns','text','members',5),
 ('start-date','Start date','date','self',6);
CREATE TRIGGER nook_profile_identity_deleted AFTER DELETE ON nook_actors BEGIN
 DELETE FROM nook_profiles WHERE user=OLD.id;
 DELETE FROM nook_profile_values WHERE user=OLD.id;
 UPDATE nook_profile_field_actions SET actor=NULL WHERE actor=OLD.id;
END;
