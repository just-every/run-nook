-- NOOK-051 administrator audit log. Each admin write door appends one body-free row
-- in the same D1 batch as its effect. An external step appends `uncertain` when it
-- starts and a settlement row (settles = that row) once its effect is confirmed or
-- fails; an interrupted step keeps no settlement and so stays uncertain.
-- Earlier history stays in its own tables and is read through src/audit/log.ts.
CREATE TABLE nook_audit(id TEXT PRIMARY KEY,at INTEGER NOT NULL,actor TEXT,service TEXT,kind TEXT NOT NULL,scope_kind TEXT NOT NULL CHECK(scope_kind IN ('workspace','channel','private','dm','person')),scope TEXT,version INTEGER,reason TEXT NOT NULL,outcome TEXT NOT NULL CHECK(outcome IN ('confirmed','failed','uncertain')),subject TEXT,detail TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detail)),settles TEXT);
CREATE INDEX nook_audit_time ON nook_audit(at,id);
CREATE INDEX nook_audit_settles ON nook_audit(settles) WHERE settles IS NOT NULL;
-- Append-only: nobody, including the person a row names, edits or removes it.
-- Erasure may only clear attribution: actor, subject and a person scope become NULL.
CREATE TRIGGER nook_audit_append_only BEFORE UPDATE ON nook_audit WHEN NEW.id IS NOT OLD.id OR NEW.at IS NOT OLD.at OR NEW.service IS NOT OLD.service OR NEW.kind IS NOT OLD.kind OR NEW.scope_kind IS NOT OLD.scope_kind OR (NEW.scope IS NOT OLD.scope AND NOT (NEW.scope IS NULL AND OLD.scope_kind='person')) OR NEW.version IS NOT OLD.version OR NEW.reason IS NOT OLD.reason OR NEW.outcome IS NOT OLD.outcome OR NEW.detail IS NOT OLD.detail OR NEW.settles IS NOT OLD.settles OR (NEW.actor IS NOT NULL AND NEW.actor IS NOT OLD.actor) OR (NEW.subject IS NOT NULL AND NEW.subject IS NOT OLD.subject) BEGIN SELECT RAISE(ABORT,'audit_append_only'); END;
CREATE TRIGGER nook_audit_no_delete BEFORE DELETE ON nook_audit BEGIN SELECT RAISE(ABORT,'audit_append_only'); END;
-- Base's account doors (role, deactivation, reactivation, invitation acceptance and
-- cancellation) change oa_operators; the row commits in that same statement. Base
-- does not tell the database who acted, so these rows name the service.
CREATE TRIGGER nook_audit_operator_change AFTER UPDATE OF status,role ON oa_operators WHEN OLD.status IS NOT NEW.status OR OLD.role IS NOT NEW.role BEGIN INSERT INTO nook_audit(id,at,actor,service,kind,scope_kind,scope,version,reason,outcome,subject,detail) VALUES(lower(hex(randomblob(16))),CAST(unixepoch('subsec')*1000 AS INTEGER),NULL,'account administration',CASE WHEN OLD.role IS NOT NEW.role THEN 'account.role' ELSE 'account.status' END,'person',NEW.id,OLD.version+1,CASE WHEN OLD.role IS NOT NEW.role THEN 'role changed' ELSE 'status changed' END,'confirmed',NEW.id,json_object('from',CASE WHEN OLD.role IS NOT NEW.role THEN OLD.role ELSE OLD.status END,'to',CASE WHEN OLD.role IS NOT NEW.role THEN NEW.role ELSE NEW.status END)); END;
