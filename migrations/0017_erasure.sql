-- Separate, content-free history keeps real live-row keys absent from archives.
CREATE TABLE nook_erased_actors(id TEXT PRIMARY KEY);
CREATE TABLE nook_erased_messages(id TEXT PRIMARY KEY,conversation TEXT NOT NULL,author TEXT NOT NULL,parent TEXT,version INTEGER NOT NULL,created TEXT NOT NULL,sequence INTEGER NOT NULL,ordinal INTEGER NOT NULL,author_ordinal INTEGER NOT NULL,intent_digest TEXT NOT NULL);
CREATE INDEX nook_erased_history ON nook_erased_messages(conversation,sequence);
CREATE TABLE nook_erased_attachments(id TEXT PRIMARY KEY,conversation TEXT NOT NULL,author TEXT NOT NULL,message TEXT,created TEXT NOT NULL,position INTEGER,intent_digest TEXT NOT NULL);
CREATE TABLE nook_erased_outcomes(id TEXT PRIMARY KEY,conversation TEXT NOT NULL,kind TEXT NOT NULL,version INTEGER NOT NULL,status TEXT NOT NULL);
CREATE VIEW nook_actor_history AS SELECT id,name,email,role,active,0 AS erased FROM nook_actors UNION ALL SELECT id,'Erased member',NULL,NULL,0,1 FROM nook_erased_actors;
CREATE VIEW nook_message_history AS SELECT *,0 AS erased FROM nook_messages UNION ALL SELECT id,conversation,author,'','',parent,version,1,created,'erased:'||id,'[erased]',sequence,ordinal,author_ordinal,1 FROM nook_erased_messages;
CREATE VIEW nook_attachment_history AS SELECT *,0 AS erased FROM nook_attachments UNION ALL SELECT id,conversation,author,message,'','application/octet-stream',0,NULL,0,'deleted',created,NULL,'erased:'||id,position,1 FROM nook_erased_attachments;
CREATE VIEW nook_outcome_history AS SELECT *,0 AS erased FROM nook_outcomes UNION ALL SELECT id,conversation,NULL,NULL,kind,'',NULL,NULL,version,status,NULL,1 FROM nook_erased_outcomes;
CREATE TABLE nook_erasure_receipts(id TEXT PRIMARY KEY,kind TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','complete')),counts TEXT NOT NULL,created INTEGER NOT NULL,completed INTEGER);
-- Work references exist only while the destructive transaction sequence is pending.
-- They are removed before completion and never travel in an archive.
CREATE TABLE nook_erasure_work(operation TEXT PRIMARY KEY,target TEXT NOT NULL,kind TEXT NOT NULL,author TEXT NOT NULL,target_role TEXT,conversation TEXT,own INTEGER NOT NULL,phase TEXT NOT NULL DEFAULT 'data',requested_by TEXT NOT NULL,requested_session TEXT NOT NULL,requested_version INTEGER NOT NULL,UNIQUE(kind,target));
CREATE TABLE nook_erasure_blobs(operation TEXT NOT NULL,object_key TEXT NOT NULL,PRIMARY KEY(operation,object_key));
CREATE TRIGGER nook_erasure_reactivation BEFORE UPDATE OF status ON oa_operators WHEN NEW.status='active' AND EXISTS(SELECT 1 FROM nook_erasure_work WHERE target=OLD.id AND kind='member') BEGIN SELECT RAISE(ABORT,'erasure_in_progress'); END;
-- Attribution can be removed without removing the workspace's domain policy.
ALTER TABLE oa_domain_rules RENAME TO nook_old_domain_rules;
CREATE TABLE oa_domain_rules(domain TEXT PRIMARY KEY,provider_id TEXT NOT NULL,created_by TEXT REFERENCES oa_operators(id),created_at INTEGER NOT NULL);
INSERT INTO oa_domain_rules SELECT * FROM nook_old_domain_rules;
DROP TABLE nook_old_domain_rules;
CREATE TRIGGER nook_erasure_message_freeze BEFORE UPDATE ON nook_messages WHEN EXISTS(SELECT 1 FROM nook_erasure_work WHERE target=OLD.id AND kind='message') BEGIN SELECT RAISE(ABORT,'erasure_in_progress'); END;
CREATE TABLE nook_erased_import_messages(id TEXT PRIMARY KEY,job TEXT NOT NULL,conversation TEXT NOT NULL,parent TEXT,sequence INTEGER NOT NULL,source_timestamp TEXT NOT NULL);
CREATE VIEW nook_import_history AS SELECT *,0 AS erased FROM nook_import_records UNION ALL SELECT id,job,'erased:'||id,conversation,'erased',source_timestamp,'{}','','',parent,sequence,1 FROM nook_erased_import_messages;

-- Preserve installation completion without retaining the completing identity.
ALTER TABLE oa_first_run RENAME TO nook_first_run_before_erasure;
CREATE TABLE oa_first_run(singleton INTEGER PRIMARY KEY CHECK(singleton=1),completed_by TEXT REFERENCES oa_operators(id),completed_at INTEGER NOT NULL);
INSERT INTO oa_first_run SELECT * FROM nook_first_run_before_erasure;
DROP TABLE nook_first_run_before_erasure;

-- Other authors' work retains state without linking erased assignees/actions.
CREATE TABLE nook_erased_assignees(outcome TEXT PRIMARY KEY);
CREATE TABLE nook_erased_outcome_actions(outcome TEXT NOT NULL,version INTEGER NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,deadline TEXT,PRIMARY KEY(outcome,version));

-- Retry commitments keep no caller-provided intent text.
CREATE UNIQUE INDEX nook_erased_message_intent ON nook_erased_messages(intent_digest);
CREATE UNIQUE INDEX nook_erased_attachment_intent ON nook_erased_attachments(intent_digest);
