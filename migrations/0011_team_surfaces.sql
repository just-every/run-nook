-- Product admission is explicit and separate from Base operator roles.
CREATE TABLE nook_access(user TEXT PRIMARY KEY REFERENCES nook_actors(id),mode TEXT NOT NULL CHECK(mode IN ('member','guest')),active INTEGER NOT NULL CHECK(active IN (0,1)),generation INTEGER NOT NULL DEFAULT 1);
CREATE TABLE nook_guest_grants(user TEXT NOT NULL REFERENCES nook_access(user),conversation TEXT NOT NULL REFERENCES nook_conversations(id),PRIMARY KEY(user,conversation));
CREATE TABLE nook_invite_plans(id TEXT PRIMARY KEY,email TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),mode TEXT NOT NULL CHECK(mode IN ('member','guest')),scopes TEXT NOT NULL CHECK(json_valid(scopes) AND json_type(scopes)='array'),generation INTEGER NOT NULL CHECK(generation>0),issuer TEXT NOT NULL,issuer_version INTEGER NOT NULL,issuer_session TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('prepared','accepted','cancelled')),prepared_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec')*1000 AS INTEGER)),CHECK(mode='member' OR role='member'));
CREATE UNIQUE INDEX nook_invite_current ON nook_invite_plans(email) WHERE state<>'cancelled';
CREATE TABLE nook_creator_revocations(conversation TEXT PRIMARY KEY REFERENCES nook_conversations(id),user TEXT NOT NULL REFERENCES nook_actors(id),generation INTEGER NOT NULL,event_seq INTEGER NOT NULL);
CREATE TABLE nook_dm_roster(conversation TEXT NOT NULL,user TEXT NOT NULL,PRIMARY KEY(conversation,user));
INSERT INTO nook_dm_roster SELECT m.conversation,m.user FROM nook_members m JOIN nook_conversations c ON c.id=m.conversation WHERE c.kind='dm';
CREATE TABLE nook_reactions(message TEXT NOT NULL REFERENCES nook_messages(id),user TEXT NOT NULL REFERENCES nook_actors(id),emoji TEXT NOT NULL CHECK(emoji IN ('👍','❤️','🎉','👀','✅','🙌')),created TEXT NOT NULL,PRIMARY KEY(message,user,emoji));
CREATE INDEX nook_reaction_message ON nook_reactions(message,emoji,user);
-- Admit only identities already explicitly represented in the product at upgrade.
INSERT INTO nook_access SELECT a.id,'member',CASE WHEN o.status='active' AND a.active=1 THEN 1 ELSE 0 END,1 FROM nook_actors a JOIN oa_operators o ON o.id=a.id;
INSERT OR IGNORE INTO nook_actors SELECT o.id,o.display_name,o.email,o.role,1 FROM oa_operators o JOIN oa_bootstrap b ON b.claim_id=o.id WHERE o.status='active';
INSERT OR IGNORE INTO nook_access SELECT o.id,'member',1,1 FROM oa_operators o JOIN oa_bootstrap b ON b.claim_id=o.id WHERE o.status='active';
-- Actor activation records current product admission, not merely a usable login.
DROP TRIGGER nook_actor_updated;
CREATE TRIGGER nook_actor_updated AFTER UPDATE OF display_name,email,role,status ON oa_operators BEGIN
 UPDATE nook_actors SET name=NEW.display_name,email=NEW.email,role=NEW.role,active= CASE WHEN NEW.status='active' AND EXISTS(SELECT 1 FROM nook_access WHERE user=NEW.id AND active=1) THEN 1 ELSE 0 END WHERE id=NEW.id;
END;
CREATE TRIGGER nook_bootstrap_access AFTER INSERT ON oa_operators WHEN NEW.status='active' AND NEW.role='owner' AND EXISTS(SELECT 1 FROM oa_bootstrap WHERE claim_id=NEW.id)
BEGIN INSERT OR IGNORE INTO nook_actors VALUES(NEW.id,NEW.display_name,NEW.email,NEW.role,1); INSERT INTO nook_access VALUES(NEW.id,'member',1,1); END;
-- Prepared plans carry exactly one durable scope set. A changed pending scope
-- conflicts; cancel the actual Base invitation before preparing a new generation.
CREATE TRIGGER nook_plan_validate BEFORE INSERT ON nook_invite_plans
BEGIN
 SELECT CASE WHEN NEW.email<>lower(trim(NEW.email)) OR NEW.state<>'prepared' OR json_array_length(NEW.scopes)<1 OR json_array_length(NEW.scopes)>50 OR (SELECT count(DISTINCT value) FROM json_each(NEW.scopes))<>json_array_length(NEW.scopes) THEN RAISE(ABORT,'invalid_invitation_scope') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM oa_operators o JOIN oa_sessions s ON s.operator_id=o.id JOIN nook_access a ON a.user=o.id WHERE o.id=NEW.issuer AND o.status='active' AND o.version=NEW.issuer_version AND (o.role='owner' OR o.role='admin' AND NEW.role='member') AND a.active=1 AND a.mode='member' AND s.id=NEW.issuer_session AND s.operator_version=o.version AND s.revoked_at IS NULL AND s.expires_at>CAST(unixepoch('subsec')*1000 AS INTEGER)) THEN RAISE(ABORT,'inviter_authority_changed') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.scopes) j WHERE j.type<>'text' OR NOT EXISTS(SELECT 1 FROM nook_conversations c JOIN nook_members m ON m.conversation=c.id WHERE c.id=j.value AND c.kind<>'dm' AND m.user=NEW.issuer AND (SELECT count(*) FROM nook_members capacity WHERE capacity.conversation=c.id)<50)) THEN RAISE(ABORT,'invalid_invitation_scope') END;
END;
CREATE TRIGGER nook_plan_immutable BEFORE UPDATE OF id,email,role,mode,scopes,generation,issuer,issuer_version,issuer_session,prepared_at ON nook_invite_plans BEGIN SELECT RAISE(ABORT,'invitation_scope_immutable'); END;
CREATE TRIGGER nook_plan_delete BEFORE DELETE ON nook_invite_plans WHEN OLD.state<>'cancelled' BEGIN SELECT RAISE(ABORT,'cancel_invitation_first'); END;
-- Acceptance is witnessed by the actual source-token-bound Base session. An
-- auth-only invitation has no witness in the product ledger and stays denied.
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
CREATE TRIGGER nook_guest_role BEFORE UPDATE OF role ON oa_operators WHEN NEW.role<>'member' AND EXISTS(SELECT 1 FROM nook_access WHERE user=NEW.id AND mode='guest') BEGIN SELECT RAISE(ABORT,'guest_role_conflict'); END;
CREATE TRIGGER nook_member_admission BEFORE INSERT ON nook_members
BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM nook_access a JOIN oa_operators o ON o.id=a.user WHERE a.user=NEW.user AND a.active=1 AND o.status='active' AND (a.mode='member' OR EXISTS(SELECT 1 FROM nook_guest_grants g WHERE g.user=a.user AND g.conversation=NEW.conversation))) THEN RAISE(ABORT,'product_scope_denied') END; END;
CREATE TRIGGER nook_member_move BEFORE UPDATE ON nook_members BEGIN SELECT RAISE(ABORT,'membership_immutable'); END;
CREATE TRIGGER nook_guest_scope_remove AFTER DELETE ON nook_guest_grants BEGIN DELETE FROM nook_members WHERE user=OLD.user AND conversation=OLD.conversation; END;
CREATE TRIGGER nook_member_scope_remove AFTER DELETE ON nook_members BEGIN DELETE FROM nook_guest_grants WHERE user=OLD.user AND conversation=OLD.conversation; END;
CREATE TRIGGER nook_reaction_admission BEFORE INSERT ON nook_reactions
BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM nook_messages m JOIN nook_members g ON g.conversation=m.conversation JOIN nook_access a ON a.user=g.user JOIN oa_operators o ON o.id=a.user WHERE m.id=NEW.message AND m.deleted=0 AND g.user=NEW.user AND a.active=1 AND o.status='active' AND (a.mode='member' OR EXISTS(SELECT 1 FROM nook_guest_grants scope WHERE scope.user=a.user AND scope.conversation=m.conversation))) THEN RAISE(ABORT,'reaction_scope_denied') END; END;
CREATE TRIGGER nook_recovered_guest_role BEFORE INSERT ON oa_operators WHEN NEW.role<>'member' AND EXISTS(SELECT 1 FROM nook_access WHERE user=NEW.id AND mode='guest') BEGIN SELECT RAISE(ABORT,'guest_role_conflict'); END;
CREATE TRIGGER nook_guest_grant_admission BEFORE INSERT ON nook_guest_grants
BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM nook_access a JOIN nook_conversations c ON c.id=NEW.conversation WHERE a.user=NEW.user AND a.mode='guest' AND a.active=1 AND c.kind<>'dm') THEN RAISE(ABORT,'invalid_guest_scope') END; END;
CREATE TRIGGER nook_conversation_creator BEFORE INSERT ON nook_conversations WHEN (SELECT authority FROM nook_storage WHERE id=1)='normalized'
BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM nook_access a JOIN oa_operators o ON o.id=a.user WHERE a.user=NEW.owner AND a.active=1 AND a.mode='member' AND o.status='active') THEN RAISE(ABORT,'product_scope_denied') END; END;
CREATE TRIGGER nook_reaction_immutable BEFORE UPDATE ON nook_reactions BEGIN SELECT RAISE(ABORT,'reaction_immutable'); END;
CREATE TRIGGER nook_access_role_insert BEFORE INSERT ON nook_access WHEN NEW.mode='guest' AND EXISTS(SELECT 1 FROM oa_operators WHERE id=NEW.user AND role<>'member') BEGIN SELECT RAISE(ABORT,'guest_role_conflict'); END;
CREATE TRIGGER nook_access_role_update BEFORE UPDATE OF mode ON nook_access WHEN NEW.mode='guest' AND EXISTS(SELECT 1 FROM oa_operators WHERE id=NEW.user AND role<>'member') BEGIN SELECT RAISE(ABORT,'guest_role_conflict'); END;
CREATE TRIGGER nook_access_prune AFTER UPDATE OF active,mode ON nook_access
BEGIN
 DELETE FROM nook_members WHERE user=NEW.user AND (NEW.active=0 OR NEW.mode='guest' AND NOT EXISTS(SELECT 1 FROM nook_guest_grants WHERE user=NEW.user AND conversation=nook_members.conversation));
 DELETE FROM nook_guest_grants WHERE user=NEW.user AND (NEW.active=0 OR NEW.mode<>'guest');
END;

-- A creator is historical attribution, not irrevocable private access. Retain
-- the actual revoked membership event and product generation for safe restore.
CREATE TRIGGER nook_creator_revoked AFTER DELETE ON nook_members WHEN EXISTS(SELECT 1 FROM nook_conversations WHERE id=OLD.conversation AND owner=OLD.user)
BEGIN
 UPDATE nook_conversations SET seq=seq+1 WHERE id=OLD.conversation;
 INSERT INTO nook_events SELECT id,seq,'access-revoked',OLD.user,OLD.user FROM nook_conversations WHERE id=OLD.conversation;
 INSERT INTO nook_creator_revocations SELECT c.id,OLD.user,a.generation,c.seq FROM nook_conversations c JOIN nook_access a ON a.user=OLD.user WHERE c.id=OLD.conversation ON CONFLICT(conversation) DO UPDATE SET user=excluded.user,generation=excluded.generation,event_seq=excluded.event_seq;
END;
CREATE TRIGGER nook_creator_readmitted AFTER INSERT ON nook_members WHEN EXISTS(SELECT 1 FROM nook_conversations WHERE id=NEW.conversation AND owner=NEW.user)
BEGIN DELETE FROM nook_creator_revocations WHERE conversation=NEW.conversation AND user=NEW.user; END;

DELETE FROM nook_members WHERE NOT EXISTS(SELECT 1 FROM nook_access a JOIN oa_operators o ON o.id=a.user WHERE a.user=nook_members.user AND a.active=1 AND o.status='active');
