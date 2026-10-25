-- Restore is a whole-content operation and remains audited. Observe the final
-- import_job boundary, after publication and trigger restoration, in the same
-- transaction. Export lifecycle events keep their existing phase trigger.
DROP TRIGGER nook_audit_portability_phase;
CREATE TRIGGER nook_audit_portability_phase AFTER UPDATE OF phase ON rer_portability_jobs
WHEN NEW.phase<>OLD.phase AND NEW.kind='export' BEGIN
 INSERT OR IGNORE INTO nook_audit VALUES('archive:'||NEW.id||':'||NEW.phase,(SELECT actor FROM nook_audit_context WHERE id=1),'portability',CAST(unixepoch('subsec')*1000 AS INTEGER),'archive.'||NEW.kind||'.'||NEW.phase,'workspace',1,CASE WHEN NEW.phase='complete' THEN 'Archive operation complete' ELSE 'Archive operation interrupted or in progress; completion unconfirmed' END,CASE WHEN NEW.phase='complete' THEN 'confirmed' ELSE 'uncertain' END,1);
END;
CREATE TRIGGER nook_audit_restore_complete AFTER UPDATE OF import_job ON rer_portability_state
WHEN OLD.import_job IS NOT NULL AND NEW.import_job IS NULL BEGIN
 INSERT INTO nook_audit(id,actor,service,at,kind,scope,version,reason,outcome,count)
 SELECT 'archive:'||id||':complete',actor,'portability',CAST(unixepoch('subsec')*1000 AS INTEGER),
  'archive.import.complete','workspace',1,
  json_object(
   'origin','restore-origin',
   'sourceContentHash',json_extract(metadata,'$.contentHash'),
   'tables',json_array_length(metadata,'$.manifest.tables'),
   'rows',(SELECT COALESCE(sum(json_extract(value,'$.count')),0) FROM json_each(metadata,'$.manifest.tables')),
   'objects',json_array_length(metadata,'$.manifest.objects'),
   'objectBytes',(SELECT COALESCE(sum(json_extract(value,'$.size')),0) FROM json_each(metadata,'$.manifest.objects')),
   'payloads',json_array_length(metadata,'$.manifest.payloads'),
   'payloadBytes',(SELECT COALESCE(sum(json_extract(value,'$.size')),0) FROM json_each(metadata,'$.manifest.payloads'))
  ),'confirmed',
  (SELECT COALESCE(sum(json_extract(value,'$.count')),0) FROM json_each(metadata,'$.manifest.tables'))
 FROM rer_portability_jobs WHERE id=OLD.import_job AND kind='import' AND phase='complete';
END;
