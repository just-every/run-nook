-- Retained current bodies are explicit content, never sanitized tombstones.
CREATE TABLE nook_retained_message_bodies(id TEXT PRIMARY KEY REFERENCES nook_erased_messages(id),body TEXT NOT NULL,body_lower TEXT NOT NULL);
CREATE TABLE nook_retained_import_bodies(id TEXT PRIMARY KEY REFERENCES nook_erased_import_messages(id),body TEXT NOT NULL,body_lower TEXT NOT NULL);
ALTER TABLE nook_erasure_receipts ADD COLUMN member_bodies TEXT NOT NULL DEFAULT 'erase' CHECK(member_bodies IN ('erase','retain'));
ALTER TABLE nook_erasure_work ADD COLUMN member_bodies TEXT NOT NULL DEFAULT 'erase' CHECK(member_bodies IN ('erase','retain'));
ALTER TABLE nook_erasure_work ADD COLUMN authority_class TEXT NOT NULL DEFAULT 'legacy-accepted';
-- Existing irreversible operations are deliberately recorded, not inferred at resume.
UPDATE nook_erasure_work SET authority_class=CASE WHEN own=1 THEN 'author' WHEN kind='member' THEN 'member-manager' WHEN kind='imported-author' THEN 'import-owner' ELSE 'channel-operator' END;
DROP VIEW nook_message_history;
CREATE VIEW nook_message_history AS SELECT *,0 AS erased,0 AS retained_body FROM nook_messages UNION ALL SELECT e.id,e.conversation,e.author,COALESCE(b.body,''),COALESCE(b.body_lower,''),e.parent,e.version,CASE WHEN b.id IS NULL THEN 1 ELSE 0 END,e.created,'erased:'||e.id,CASE WHEN b.id IS NULL THEN '[erased]' ELSE '{}' END,e.sequence,e.ordinal,e.author_ordinal,1,CASE WHEN b.id IS NULL THEN 0 ELSE 1 END FROM nook_erased_messages e LEFT JOIN nook_retained_message_bodies b ON b.id=e.id;
DROP VIEW nook_import_history;
CREATE VIEW nook_import_history AS SELECT *,0 AS erased,0 AS retained_body FROM nook_import_records UNION ALL SELECT e.id,e.job,'erased:'||e.id,e.conversation,'erased',e.source_timestamp,'{}',COALESCE(b.body,''),COALESCE(b.body_lower,''),e.parent,e.sequence,1,CASE WHEN b.id IS NULL THEN 0 ELSE 1 END FROM nook_erased_import_messages e LEFT JOIN nook_retained_import_bodies b ON b.id=e.id;
-- Pending deletions keep attribution only until their bytes are verified absent.
-- Older queue rows can have irrecoverably unknown ownership; member erasure
-- conservatively waits for those already-authorized deletions as well.
ALTER TABLE nook_object_deletes ADD COLUMN erasure_author TEXT;
-- Import custody owner is not content authorship: pending imported media and
-- whole raw ZIPs conservatively have unknown attribution.
UPDATE nook_object_deletes SET erasure_author=COALESCE(
 (SELECT author FROM nook_attachments WHERE object_key=nook_object_deletes.object_key LIMIT 1),
 (SELECT w.author FROM nook_erasure_blobs b JOIN nook_erasure_work w ON w.operation=b.operation WHERE b.object_key=nook_object_deletes.object_key AND w.kind IN ('message','attachment') LIMIT 1))
 WHERE NOT EXISTS(SELECT 1 FROM nook_import_uploads WHERE object_key=nook_object_deletes.object_key)
 AND NOT EXISTS(SELECT 1 FROM nook_import_objects WHERE object_key=nook_object_deletes.object_key);
CREATE TRIGGER nook_delete_attribution AFTER INSERT ON nook_object_deletes WHEN NEW.erasure_author IS NULL BEGIN
 UPDATE nook_object_deletes SET erasure_author=(SELECT author FROM nook_attachments WHERE object_key=NEW.object_key LIMIT 1)
 WHERE object_key=NEW.object_key
 AND NOT EXISTS(SELECT 1 FROM nook_import_uploads WHERE object_key=NEW.object_key)
 AND NOT EXISTS(SELECT 1 FROM nook_import_objects WHERE object_key=NEW.object_key)
 AND NOT EXISTS(SELECT 1 FROM nook_attachments a JOIN nook_import_records r ON r.id=a.message WHERE a.object_key=NEW.object_key);
END;
