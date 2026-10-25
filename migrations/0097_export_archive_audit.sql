-- NOOK-051 audits exports. A restore only brings an archive's own rows back: its
-- import job is transfer bookkeeping that never travels, so it adds no audit row
-- and exporting the restored installation again yields the same content hash.
DROP TRIGGER nook_audit_portability_phase;
CREATE TRIGGER nook_audit_portability_phase AFTER UPDATE OF phase ON rer_portability_jobs WHEN NEW.phase<>OLD.phase AND NEW.kind='export' BEGIN
 INSERT OR IGNORE INTO nook_audit VALUES('archive:'||NEW.id||':'||NEW.phase,(SELECT actor FROM nook_audit_context WHERE id=1),'portability',CAST(unixepoch('subsec')*1000 AS INTEGER),'archive.'||NEW.kind||'.'||NEW.phase,'workspace',1,CASE WHEN NEW.phase='complete' THEN 'Archive operation complete' ELSE 'Archive operation interrupted or in progress; completion unconfirmed' END,CASE WHEN NEW.phase='complete' THEN 'confirmed' ELSE 'uncertain' END,1);
END;
