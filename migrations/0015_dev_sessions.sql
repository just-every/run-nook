-- Local dev identity for an existing store: Base's operator-auth schema/dev-sessions.sql (at the pinned
-- Base commit) with one Nook addition. Base's file assumes nothing names oa_sessions, but four Nook
-- triggers (0011) read it, and SQLite cannot rename over a trigger body that names a missing table.
-- Those triggers are dropped around the rebuild and recreated unchanged below.
-- SQLite cannot change a CHECK in place, so oa_sessions is rebuilt with 'dev' admitted, keeping every
-- row, column, index and constraint. No table has a foreign key to oa_sessions.
DROP TRIGGER IF EXISTS nook_plan_validate;
DROP TRIGGER IF EXISTS nook_invite_accept;
DROP TRIGGER IF EXISTS nook_invite_grant;
DROP TRIGGER IF EXISTS nook_deactivate;
CREATE TABLE oa_sessions_dev_rebuild (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 operator_id TEXT NOT NULL REFERENCES oa_operators(id), operator_version INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('native','review','oidc','password','dev')),
 source_token_id TEXT UNIQUE REFERENCES oa_tokens(id),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
);
INSERT INTO oa_sessions_dev_rebuild(id,token_hash,operator_id,operator_version,kind,source_token_id,created_at,expires_at,revoked_at)
 SELECT id,token_hash,operator_id,operator_version,kind,source_token_id,created_at,expires_at,revoked_at FROM oa_sessions;
DROP TABLE oa_sessions;
ALTER TABLE oa_sessions_dev_rebuild RENAME TO oa_sessions;
CREATE INDEX oa_sessions_operator ON oa_sessions(operator_id);
CREATE TABLE IF NOT EXISTS oa_dev_credentials (
 credential TEXT NOT NULL, id TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(credential, id)
);
CREATE TRIGGER nook_plan_validate BEFORE INSERT ON nook_invite_plans
BEGIN
 SELECT CASE WHEN NEW.email<>lower(trim(NEW.email)) OR NEW.state<>'prepared' OR json_array_length(NEW.scopes)<1 OR json_array_length(NEW.scopes)>50 OR (SELECT count(DISTINCT value) FROM json_each(NEW.scopes))<>json_array_length(NEW.scopes) THEN RAISE(ABORT,'invalid_invitation_scope') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM oa_operators o JOIN oa_sessions s ON s.operator_id=o.id JOIN nook_access a ON a.user=o.id WHERE o.id=NEW.issuer AND o.status='active' AND o.version=NEW.issuer_version AND (o.role='owner' OR o.role='admin' AND NEW.role='member') AND a.active=1 AND a.mode='member' AND s.id=NEW.issuer_session AND s.operator_version=o.version AND s.revoked_at IS NULL AND s.expires_at>CAST(unixepoch('subsec')*1000 AS INTEGER)) THEN RAISE(ABORT,'inviter_authority_changed') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.scopes) j WHERE j.type<>'text' OR NOT EXISTS(SELECT 1 FROM nook_conversations c JOIN nook_members m ON m.conversation=c.id WHERE c.id=j.value AND c.kind<>'dm' AND m.user=NEW.issuer AND (SELECT count(*) FROM nook_members capacity WHERE capacity.conversation=c.id)<50)) THEN RAISE(ABORT,'invalid_invitation_scope') END;
END;
CREATE TRIGGER nook_invite_accept BEFORE UPDATE OF status ON oa_operators WHEN OLD.status='invited' AND NEW.status='active'
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_tokens t ON t.id=s.source_token_id AND t.kind='invite' AND t.operator_id=s.operator_id JOIN nook_invite_plans p ON p.email=NEW.email AND p.role=NEW.role AND p.issuer=t.issuer_id AND p.issuer_version=t.issuer_version AND p.state='prepared' AND p.prepared_at<=t.created_at WHERE s.operator_id=NEW.id AND s.operator_version=OLD.version+1 AND (NOT EXISTS(SELECT 1 FROM oa_operators i JOIN nook_access a ON a.user=i.id WHERE i.id=p.issuer AND i.status='active' AND i.version=p.issuer_version AND a.active=1 AND a.mode='member' AND (i.role='owner' OR i.role='admin' AND p.role='member')) OR EXISTS(SELECT 1 FROM json_each(p.scopes) j WHERE NOT EXISTS(SELECT 1 FROM nook_conversations c JOIN nook_members m ON m.conversation=c.id WHERE c.id=j.value AND c.kind<>'dm' AND m.user=p.issuer AND (SELECT count(*) FROM nook_members capacity WHERE capacity.conversation=c.id)<50)))) THEN RAISE(ABORT,'invitation_scope_changed') END;
END;
CREATE TRIGGER nook_invite_grant AFTER UPDATE OF status ON oa_operators WHEN OLD.status='invited' AND NEW.status='active'
BEGIN
 INSERT INTO nook_actors VALUES(NEW.id,NEW.display_name,NEW.email,NEW.role,1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,role=excluded.role,active=1;
 INSERT INTO nook_access SELECT NEW.id,p.mode,1,p.generation FROM oa_sessions s JOIN oa_tokens t ON t.id=s.source_token_id AND t.kind='invite' AND t.operator_id=s.operator_id JOIN nook_invite_plans p ON p.email=NEW.email AND p.role=NEW.role AND p.issuer=t.issuer_id AND p.issuer_version=t.issuer_version AND p.state='prepared' AND p.prepared_at<=t.created_at WHERE s.operator_id=NEW.id AND s.operator_version=OLD.version+1 ON CONFLICT(user) DO UPDATE SET mode=excluded.mode,active=1,generation=excluded.generation;
 INSERT INTO nook_guest_grants SELECT NEW.id,j.value FROM oa_sessions s JOIN oa_tokens t ON t.id=s.source_token_id AND t.kind='invite' AND t.operator_id=s.operator_id JOIN nook_invite_plans p ON p.email=NEW.email AND p.role=NEW.role AND p.issuer=t.issuer_id AND p.issuer_version=t.issuer_version AND p.state='prepared' AND p.prepared_at<=t.created_at,json_each(p.scopes) j WHERE s.operator_id=NEW.id AND s.operator_version=OLD.version+1 AND p.mode='guest';
 INSERT INTO nook_members SELECT j.value,NEW.id FROM oa_sessions s JOIN oa_tokens t ON t.id=s.source_token_id AND t.kind='invite' AND t.operator_id=s.operator_id JOIN nook_invite_plans p ON p.email=NEW.email AND p.role=NEW.role AND p.issuer=t.issuer_id AND p.issuer_version=t.issuer_version AND p.state='prepared' AND p.prepared_at<=t.created_at,json_each(p.scopes) j WHERE s.operator_id=NEW.id AND s.operator_version=OLD.version+1;
 UPDATE nook_invite_plans SET state='accepted' WHERE id IN (SELECT p.id FROM oa_sessions s JOIN oa_tokens t ON t.id=s.source_token_id AND t.kind='invite' AND t.operator_id=s.operator_id JOIN nook_invite_plans p ON p.email=NEW.email AND p.role=NEW.role AND p.issuer=t.issuer_id AND p.issuer_version=t.issuer_version AND p.state='prepared' AND p.prepared_at<=t.created_at WHERE s.operator_id=NEW.id AND s.operator_version=OLD.version+1);
END;
CREATE TRIGGER nook_deactivate AFTER UPDATE OF status ON oa_operators WHEN NEW.status='inactive' AND OLD.status<>NEW.status
BEGIN
 UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,CAST(unixepoch('subsec')*1000 AS INTEGER)) WHERE operator_id=NEW.id;
 UPDATE nook_access SET active=0,generation=generation+1 WHERE user=NEW.id;
 UPDATE nook_actors SET active=0 WHERE id=NEW.id;
 DELETE FROM nook_members WHERE user=NEW.id;
 DELETE FROM nook_guest_grants WHERE user=NEW.id;
 UPDATE nook_invite_plans SET state='cancelled' WHERE email=NEW.email AND state='prepared';
END;
