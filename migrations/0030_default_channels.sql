-- Organization policy never grants private history or revives a revoked admission.
CREATE TABLE nook_default_policy(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL CHECK(version>0));
CREATE TABLE nook_default_channels(conversation TEXT PRIMARY KEY REFERENCES nook_conversations(id),mandatory INTEGER NOT NULL CHECK(mandatory IN (0,1)));
CREATE TABLE nook_default_actions(
 id TEXT PRIMARY KEY,version INTEGER NOT NULL CHECK(version>0),
 conversation TEXT NOT NULL REFERENCES nook_conversations(id),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),mandatory INTEGER NOT NULL CHECK(mandatory IN (0,1)),
 actor TEXT,created TEXT NOT NULL,UNIQUE(version,conversation),CHECK(enabled=1 OR mandatory=0)
);
CREATE TABLE nook_default_admissions(user TEXT PRIMARY KEY REFERENCES nook_actors(id),state TEXT NOT NULL CHECK(state IN ('pending','complete')));
-- Existing identities are not new members, including those currently inactive.
INSERT INTO nook_default_admissions SELECT id,'complete' FROM nook_actors;
CREATE TRIGGER nook_default_admission AFTER INSERT ON nook_access BEGIN
 INSERT OR IGNORE INTO nook_default_admissions
 SELECT NEW.user,CASE WHEN NEW.active=1 AND NEW.mode='member' AND EXISTS(
  SELECT 1 FROM oa_sessions s LEFT JOIN oa_tokens t ON t.id=s.source_token_id
  JOIN oa_operators o ON o.id=s.operator_id
  WHERE s.operator_id=NEW.user AND o.status='active'
   AND s.revoked_at IS NULL AND s.expires_at>CAST(unixepoch('subsec')*1000 AS INTEGER)
   AND (s.kind='dev' AND s.operator_version=o.version OR s.kind='native'
    AND t.kind='invite' AND t.operator_id=NEW.user AND t.consumed_at IS NULL
    AND s.operator_version IN (o.version,o.version+1))
 ) THEN 'pending' ELSE 'complete' END;
END;
-- Regrant and access-mode changes are explicit scopes, never another first join.
CREATE TRIGGER nook_default_readmission AFTER UPDATE OF active,mode,generation ON nook_access BEGIN
 UPDATE nook_default_admissions SET state='complete' WHERE user=NEW.user;
END;
-- Offline identity recovery reintroduces credentials for retained product IDs.
-- It is not a new invitation, even if the backup captured a pending first join.
CREATE TRIGGER nook_default_recovery AFTER INSERT ON oa_operators
WHEN EXISTS(SELECT 1 FROM nook_access WHERE user=NEW.id) BEGIN
 INSERT INTO nook_default_admissions VALUES(NEW.id,'complete')
 ON CONFLICT(user) DO UPDATE SET state='complete';
END;
