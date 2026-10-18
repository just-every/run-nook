-- Channel invitations and acceptance use the same capacity as channel membership.
-- Keep current inviter, session, scope and acceptance authority checks.
DROP TRIGGER nook_plan_validate;
DROP TRIGGER nook_invite_accept;
CREATE TRIGGER nook_plan_validate BEFORE INSERT ON nook_invite_plans
BEGIN
 SELECT CASE WHEN NEW.email<>lower(trim(NEW.email)) OR NEW.state<>'prepared' OR json_array_length(NEW.scopes)<1 OR json_array_length(NEW.scopes)>50 OR (SELECT count(DISTINCT value) FROM json_each(NEW.scopes))<>json_array_length(NEW.scopes) THEN RAISE(ABORT,'invalid_invitation_scope') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM oa_operators o JOIN oa_sessions s ON s.operator_id=o.id JOIN nook_access a ON a.user=o.id WHERE o.id=NEW.issuer AND o.status='active' AND o.version=NEW.issuer_version AND (o.role='owner' OR o.role='admin' AND NEW.role='member') AND a.active=1 AND a.mode='member' AND s.id=NEW.issuer_session AND s.operator_version=o.version AND s.revoked_at IS NULL AND s.expires_at>CAST(unixepoch('subsec')*1000 AS INTEGER)) THEN RAISE(ABORT,'inviter_authority_changed') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.scopes) j WHERE j.type<>'text' OR NOT EXISTS(SELECT 1 FROM nook_conversations c JOIN nook_members m ON m.conversation=c.id WHERE c.id=j.value AND c.kind<>'dm' AND m.user=NEW.issuer AND (SELECT count(*) FROM nook_members capacity WHERE capacity.conversation=c.id)<1000)) THEN RAISE(ABORT,'invalid_invitation_scope') END;
END;
CREATE TRIGGER nook_invite_accept BEFORE UPDATE OF status ON oa_operators WHEN OLD.status='invited' AND NEW.status='active'
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_tokens t ON t.id=s.source_token_id AND t.kind='invite' AND t.operator_id=s.operator_id JOIN nook_invite_plans p ON p.email=NEW.email AND p.role=NEW.role AND p.issuer=t.issuer_id AND p.issuer_version=t.issuer_version AND p.state='prepared' AND p.prepared_at<=t.created_at WHERE s.operator_id=NEW.id AND s.operator_version=OLD.version+1 AND (NOT EXISTS(SELECT 1 FROM oa_operators i JOIN nook_access a ON a.user=i.id WHERE i.id=p.issuer AND i.status='active' AND i.version=p.issuer_version AND a.active=1 AND a.mode='member' AND (i.role='owner' OR i.role='admin' AND p.role='member')) OR EXISTS(SELECT 1 FROM json_each(p.scopes) j WHERE NOT EXISTS(SELECT 1 FROM nook_conversations c JOIN nook_members m ON m.conversation=c.id WHERE c.id=j.value AND c.kind<>'dm' AND m.user=p.issuer AND (SELECT count(*) FROM nook_members capacity WHERE capacity.conversation=c.id)<1000)))) THEN RAISE(ABORT,'invitation_scope_changed') END;
END;
