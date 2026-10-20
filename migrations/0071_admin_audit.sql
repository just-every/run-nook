-- NOOK-051. Audit facts are explicit, body-free projections of existing write journals.
-- Triggers execute inside the originating D1 statement/batch; rollback includes the audit.
CREATE TABLE nook_audit(
 id TEXT PRIMARY KEY,actor TEXT,service TEXT NOT NULL,at INTEGER NOT NULL,
 kind TEXT NOT NULL,scope TEXT NOT NULL,version INTEGER NOT NULL,
 reason TEXT NOT NULL,outcome TEXT NOT NULL CHECK(outcome IN ('confirmed','failed','uncertain')),
 count INTEGER NOT NULL CHECK(count>=0)
);
CREATE INDEX nook_audit_time ON nook_audit(at,id);
CREATE INDEX nook_audit_actor ON nook_audit(actor,at);
-- A transaction-local writer identity, cleared before the D1 batch commits.
CREATE TABLE nook_audit_context(id INTEGER PRIMARY KEY CHECK(id=1),actor TEXT);
CREATE VIEW nook_audit_history AS
WITH part0 AS MATERIALIZED (
SELECT 'channel:'||id AS id,actor AS actor,'nook_channel_actions' AS service,CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER) AS at,'channel.'||action AS kind,conversation AS scope,version AS version,'Channel lifecycle change' AS reason,'confirmed' AS outcome,1 AS count FROM nook_channel_actions WHERE 1
UNION ALL
SELECT 'posting:'||action AS id,(SELECT actor FROM nook_channel_actions WHERE id=nook_posting_changes.action) AS actor,'nook_posting_changes' AS service,(SELECT CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER) FROM nook_channel_actions WHERE id=nook_posting_changes.action) AS at,'policy.posting' AS kind,(SELECT conversation FROM nook_channel_actions WHERE id=nook_posting_changes.action) AS scope,(SELECT version FROM nook_channel_actions WHERE id=nook_posting_changes.action) AS version,'Posting permission: '||level||'; replies: '||replies AS reason,'confirmed' AS outcome,people AS count FROM nook_posting_changes WHERE 1
UNION ALL
SELECT 'default:'||id AS id,actor AS actor,'nook_default_actions' AS service,CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER) AS at,'policy.default-channels' AS kind,conversation AS scope,version AS version,CASE enabled WHEN 1 THEN 'Default channel enabled' ELSE 'Default channel disabled' END AS reason,'confirmed' AS outcome,1 AS count FROM nook_default_actions WHERE 1
UNION ALL
SELECT 'broadcast:'||id AS id,actor AS actor,'nook_broadcast_actions' AS service,CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER) AS at,'policy.broadcast' AS kind,scope AS scope,version AS version,'Broadcast level: '||level AS reason,'confirmed' AS outcome,people AS count FROM nook_broadcast_actions WHERE 1
),
part1 AS MATERIALIZED (
SELECT 'profile:'||id AS id,actor AS actor,'nook_profile_field_actions' AS service,created AS at,'policy.profile-fields' AS kind,'workspace' AS scope,1 AS version,'Profile field definitions changed' AS reason,'confirmed' AS outcome,fields AS count FROM nook_profile_field_actions WHERE 1
UNION ALL
SELECT 'export-policy:'||id AS id,actor AS actor,'nook_exit_policy_actions' AS service,CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER) AS at,'policy.export' AS kind,'workspace' AS scope,version AS version,CASE enabled WHEN 1 THEN 'Workspace export enabled' ELSE 'Workspace export disabled' END AS reason,'confirmed' AS outcome,recipients AS count FROM nook_exit_policy_actions WHERE 1
UNION ALL
SELECT 'integration:'||id AS id,actor AS actor,'nook_integration_audit' AS service,at AS at,'integration.'||action AS kind,COALESCE(conversation,'workspace') AS scope,1 AS version,'Token label: '||name AS reason,CASE action WHEN 'refuse' THEN 'failed' ELSE 'confirmed' END AS outcome,1 AS count FROM nook_integration_audit WHERE 1
UNION ALL
SELECT 'erasure:'||id||':'||state AS id,NULL AS actor,'nook_erasure_receipts' AS service,COALESCE(completed,created) AS at,'erasure.'||kind AS kind,'workspace' AS scope,1 AS version,CASE state WHEN 'complete' THEN 'Erasure receipt complete' ELSE 'Erasure pending; completion unconfirmed' END AS reason,CASE state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END AS outcome,COALESCE((SELECT sum(CASE WHEN type='integer' THEN value ELSE 0 END) FROM json_each(counts)),0) AS count FROM nook_erasure_receipts WHERE 1
),
part2 AS MATERIALIZED (
SELECT 'invitation:'||id||':'||state AS id,issuer AS actor,'nook_invite_plans' AS service,prepared_at AS at,'invitation.'||state AS kind,'workspace' AS scope,generation AS version,'Invitation role: '||role||'; access: '||mode AS reason,'confirmed' AS outcome,json_array_length(scopes) AS count FROM nook_invite_plans WHERE 1
UNION ALL
SELECT 'cancellation:'||operator_id||':'||operator_version AS id,NULL AS actor,'oa_invitation_cancellations' AS service,CAST(unixepoch('subsec')*1000 AS INTEGER) AS at,'invitation.cancelled' AS kind,'workspace' AS scope,operator_version AS version,'Invitation cancelled; original event time unavailable for pre-audit records' AS reason,'confirmed' AS outcome,1 AS count FROM oa_invitation_cancellations WHERE 1
UNION ALL
SELECT 'auth:'||id AS id,NULLIF(actor_id,'') AS actor,'oa_auth_audit' AS service,created_at AS at,'auth.'||action AS kind,'workspace' AS scope,1 AS version,'Authentication authority change' AS reason,'confirmed' AS outcome,1 AS count FROM oa_auth_audit WHERE 1
UNION ALL
SELECT 'session:'||id||':start' AS id,operator_id AS actor,'oa_sessions' AS service,created_at AS at,'session.started' AS kind,'workspace' AS scope,operator_version AS version,'Session method: '||kind AS reason,'confirmed' AS outcome,1 AS count FROM oa_sessions WHERE 1
),
part3 AS MATERIALIZED (
SELECT 'session:'||id||':revoked' AS id,operator_id AS actor,'oa_sessions' AS service,revoked_at AS at,'session.revoked' AS kind,'workspace' AS scope,operator_version AS version,'Session revoked' AS reason,'confirmed' AS outcome,1 AS count FROM oa_sessions WHERE revoked_at IS NOT NULL
UNION ALL
SELECT 'membership:'||seq AS id,NULL AS actor,'nook_exit_membership' AS service,CAST(round((julianday(at)-2440587.5)*86400000) AS INTEGER) AS at,'membership.'||action AS kind,conversation AS scope,1 AS version,CASE action WHEN 'baseline' THEN 'Membership observed at adoption; original join unknown' WHEN 'join' THEN 'Channel membership granted' ELSE 'Channel membership removed' END AS reason,'confirmed' AS outcome,1 AS count FROM nook_exit_membership WHERE 1
UNION ALL
SELECT 'override:'||id AS id,author AS actor,'nook_messages' AS service,CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER) AS at,'post.admin-override' AS kind,conversation AS scope,version AS version,'Labeled administrative posting override' AS reason,'confirmed' AS outcome,1 AS count FROM nook_messages WHERE json_valid(payload) AND json_extract(payload,'$.adminOverride')=1
UNION ALL
SELECT 'export:'||id||':'||state||':'||revision AS id,owner AS actor,'nook_exit_jobs' AS service,CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER) AS at,'export.'||state AS kind,'workspace' AS scope,revision+1 AS version,CASE state WHEN 'complete' THEN 'Readable export complete' WHEN 'cancelled' THEN 'Readable export interrupted; no complete artifact confirmed' ELSE 'Readable export in progress; completion unconfirmed' END AS reason,CASE state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END AS outcome,records AS count FROM nook_exit_jobs WHERE 1
),
part4 AS MATERIALIZED (
SELECT 'import:'||id||':'||state AS id,owner AS actor,'nook_imports' AS service,CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER) AS at,'import.'||state AS kind,'workspace' AS scope,1 AS version,CASE state WHEN 'complete' THEN 'Reviewed import published' ELSE 'Import in progress; publication unconfirmed' END AS reason,CASE state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END AS outcome,1 AS count FROM nook_imports WHERE 1
UNION ALL
SELECT 'import-approval:'||plan_id AS id,owner AS actor,'ik_door_approvals' AS service,CAST(round((julianday(approved_at)-2440587.5)*86400000) AS INTEGER) AS at,'import.approved' AS kind,'workspace' AS scope,1 AS version,'Human approval for reviewed import' AS reason,'confirmed' AS outcome,1 AS count FROM ik_door_approvals WHERE 1
UNION ALL
SELECT 'import-failure:'||plan_id AS id,NULL AS actor,'ik_door_apply_failures' AS service,CAST(unixepoch('subsec')*1000 AS INTEGER) AS at,'import.failed' AS kind,'workspace' AS scope,1 AS version,'Reviewed import failed' AS reason,'failed' AS outcome,1 AS count FROM ik_door_apply_failures WHERE 1
UNION ALL
SELECT 'conversion:'||source AS id,actor AS actor,'nook_group_conversions' AS service,CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER) AS at,'channel.converted' AS kind,destination AS scope,1 AS version,'Group conversation converted without widening its audience' AS reason,'confirmed' AS outcome,1 AS count FROM nook_group_conversions WHERE 1
)
SELECT * FROM part0 UNION ALL SELECT * FROM part1 UNION ALL SELECT * FROM part2 UNION ALL SELECT * FROM part3 UNION ALL SELECT * FROM part4;
INSERT OR IGNORE INTO nook_audit SELECT id,CASE WHEN actor IN (SELECT id FROM nook_actors) THEN actor ELSE NULL END,service,at,kind,scope,version,reason,outcome,count FROM nook_audit_history;
CREATE TRIGGER nook_audit_0_insert AFTER INSERT ON nook_channel_actions BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'channel:'||id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),actor),'nook_channel_actions',CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER),'channel.'||action,conversation,version,'Channel lifecycle change','confirmed',1 FROM nook_channel_actions WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_1_insert AFTER INSERT ON nook_posting_changes BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'posting:'||action,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),(SELECT actor FROM nook_channel_actions WHERE id=nook_posting_changes.action)),'nook_posting_changes',(SELECT CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER) FROM nook_channel_actions WHERE id=nook_posting_changes.action),'policy.posting',(SELECT conversation FROM nook_channel_actions WHERE id=nook_posting_changes.action),(SELECT version FROM nook_channel_actions WHERE id=nook_posting_changes.action),'Posting permission: '||level||'; replies: '||replies,'confirmed',people FROM nook_posting_changes WHERE action=NEW.action AND (1);
END;
CREATE TRIGGER nook_audit_2_insert AFTER INSERT ON nook_default_actions BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'default:'||id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),actor),'nook_default_actions',CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER),'policy.default-channels',conversation,version,CASE enabled WHEN 1 THEN 'Default channel enabled' ELSE 'Default channel disabled' END,'confirmed',1 FROM nook_default_actions WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_3_insert AFTER INSERT ON nook_broadcast_actions BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'broadcast:'||id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),actor),'nook_broadcast_actions',CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER),'policy.broadcast',scope,version,'Broadcast level: '||level,'confirmed',people FROM nook_broadcast_actions WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_4_insert AFTER INSERT ON nook_profile_field_actions BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'profile:'||id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),actor),'nook_profile_field_actions',created,'policy.profile-fields','workspace',1,'Profile field definitions changed','confirmed',fields FROM nook_profile_field_actions WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_5_insert AFTER INSERT ON nook_exit_policy_actions BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'export-policy:'||id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),actor),'nook_exit_policy_actions',CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER),'policy.export','workspace',version,CASE enabled WHEN 1 THEN 'Workspace export enabled' ELSE 'Workspace export disabled' END,'confirmed',recipients FROM nook_exit_policy_actions WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_6_insert AFTER INSERT ON nook_integration_audit BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'integration:'||id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),actor),'nook_integration_audit',at,'integration.'||action,COALESCE(conversation,'workspace'),1,'Token label: '||name,CASE action WHEN 'refuse' THEN 'failed' ELSE 'confirmed' END,1 FROM nook_integration_audit WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_7_insert AFTER INSERT ON nook_erasure_receipts BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'erasure:'||id||':'||state,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),NULL),'nook_erasure_receipts',COALESCE(completed,created),'erasure.'||kind,'workspace',1,CASE state WHEN 'complete' THEN 'Erasure receipt complete' ELSE 'Erasure pending; completion unconfirmed' END,CASE state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END,COALESCE((SELECT sum(CASE WHEN type='integer' THEN value ELSE 0 END) FROM json_each(counts)),0) FROM nook_erasure_receipts WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_7_update AFTER UPDATE OF state ON nook_erasure_receipts BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'erasure:'||id||':'||state,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),NULL),'nook_erasure_receipts',COALESCE(completed,created),'erasure.'||kind,'workspace',1,CASE state WHEN 'complete' THEN 'Erasure receipt complete' ELSE 'Erasure pending; completion unconfirmed' END,CASE state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END,COALESCE((SELECT sum(CASE WHEN type='integer' THEN value ELSE 0 END) FROM json_each(counts)),0) FROM nook_erasure_receipts WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_8_insert AFTER INSERT ON nook_invite_plans BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'invitation:'||id||':'||state,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),issuer),'nook_invite_plans',prepared_at,'invitation.'||state,'workspace',generation,'Invitation role: '||role||'; access: '||mode,'confirmed',json_array_length(scopes) FROM nook_invite_plans WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_8_update AFTER UPDATE OF state ON nook_invite_plans BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'invitation:'||id||':'||state,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),issuer),'nook_invite_plans',CAST(unixepoch('subsec')*1000 AS INTEGER),'invitation.'||state,'workspace',generation,'Invitation role: '||role||'; access: '||mode,'confirmed',json_array_length(scopes) FROM nook_invite_plans WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_9_insert AFTER INSERT ON oa_invitation_cancellations BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'cancellation:'||operator_id||':'||operator_version,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),NULL),'oa_invitation_cancellations',CAST(unixepoch('subsec')*1000 AS INTEGER),'invitation.cancelled','workspace',operator_version,'Invitation cancelled; original event time unavailable for pre-audit records','confirmed',1 FROM oa_invitation_cancellations WHERE operator_id=NEW.operator_id AND (1);
END;
CREATE TRIGGER nook_audit_9_update AFTER UPDATE OF operator_version ON oa_invitation_cancellations BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'cancellation:'||operator_id||':'||operator_version,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),NULL),'oa_invitation_cancellations',CAST(unixepoch('subsec')*1000 AS INTEGER),'invitation.cancelled','workspace',operator_version,'Invitation cancelled; original event time unavailable for pre-audit records','confirmed',1 FROM oa_invitation_cancellations WHERE operator_id=NEW.operator_id AND (1);
END;
CREATE TRIGGER nook_audit_10_insert AFTER INSERT ON oa_auth_audit BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'auth:'||id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),NULLIF(actor_id,'')),'oa_auth_audit',created_at,'auth.'||action,'workspace',1,'Authentication authority change','confirmed',1 FROM oa_auth_audit WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_11_insert AFTER INSERT ON oa_sessions BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'session:'||id||':start',COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),operator_id),'oa_sessions',created_at,'session.started','workspace',operator_version,'Session method: '||kind,'confirmed',1 FROM oa_sessions WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_12_insert AFTER INSERT ON oa_sessions BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'session:'||id||':revoked',COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),operator_id),'oa_sessions',revoked_at,'session.revoked','workspace',operator_version,'Session revoked','confirmed',1 FROM oa_sessions WHERE id=NEW.id AND (revoked_at IS NOT NULL);
END;
CREATE TRIGGER nook_audit_12_update AFTER UPDATE OF revoked_at ON oa_sessions BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'session:'||id||':revoked',COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),operator_id),'oa_sessions',revoked_at,'session.revoked','workspace',operator_version,'Session revoked','confirmed',1 FROM oa_sessions WHERE id=NEW.id AND (revoked_at IS NOT NULL);
END;
CREATE TRIGGER nook_audit_13_insert AFTER INSERT ON nook_exit_membership BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'membership:'||seq,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),NULL),'nook_exit_membership',CAST(round((julianday(at)-2440587.5)*86400000) AS INTEGER),'membership.'||action,conversation,1,CASE action WHEN 'baseline' THEN 'Membership observed at adoption; original join unknown' WHEN 'join' THEN 'Channel membership granted' ELSE 'Channel membership removed' END,'confirmed',1 FROM nook_exit_membership WHERE seq=NEW.seq AND (1);
END;
CREATE TRIGGER nook_audit_14_insert AFTER INSERT ON nook_messages BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'override:'||id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),author),'nook_messages',CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER),'post.admin-override',conversation,version,'Labeled administrative posting override','confirmed',1 FROM nook_messages WHERE id=NEW.id AND (json_valid(payload) AND json_extract(payload,'$.adminOverride')=1);
END;
CREATE TRIGGER nook_audit_15_insert AFTER INSERT ON nook_exit_jobs BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'export:'||id||':'||state||':'||revision,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),owner),'nook_exit_jobs',CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER),'export.'||state,'workspace',revision+1,CASE state WHEN 'complete' THEN 'Readable export complete' WHEN 'cancelled' THEN 'Readable export interrupted; no complete artifact confirmed' ELSE 'Readable export in progress; completion unconfirmed' END,CASE state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END,records FROM nook_exit_jobs WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_15_update AFTER UPDATE OF state ON nook_exit_jobs BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'export:'||id||':'||state||':'||revision,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),owner),'nook_exit_jobs',CAST(unixepoch('subsec')*1000 AS INTEGER),'export.'||state,'workspace',revision+1,CASE state WHEN 'complete' THEN 'Readable export complete' WHEN 'cancelled' THEN 'Readable export interrupted; no complete artifact confirmed' ELSE 'Readable export in progress; completion unconfirmed' END,CASE state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END,records FROM nook_exit_jobs WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_16_insert AFTER INSERT ON nook_imports BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'import:'||id||':'||state,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),owner),'nook_imports',CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER),'import.'||state,'workspace',1,CASE state WHEN 'complete' THEN 'Reviewed import published' ELSE 'Import in progress; publication unconfirmed' END,CASE state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END,1 FROM nook_imports WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_16_update AFTER UPDATE OF state ON nook_imports BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'import:'||id||':'||state,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),owner),'nook_imports',CAST(unixepoch('subsec')*1000 AS INTEGER),'import.'||state,'workspace',1,CASE state WHEN 'complete' THEN 'Reviewed import published' ELSE 'Import in progress; publication unconfirmed' END,CASE state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END,1 FROM nook_imports WHERE id=NEW.id AND (1);
END;
CREATE TRIGGER nook_audit_17_insert AFTER INSERT ON ik_door_approvals BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'import-approval:'||plan_id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),owner),'ik_door_approvals',CAST(round((julianday(approved_at)-2440587.5)*86400000) AS INTEGER),'import.approved','workspace',1,'Human approval for reviewed import','confirmed',1 FROM ik_door_approvals WHERE plan_id=NEW.plan_id AND (1);
END;
CREATE TRIGGER nook_audit_18_insert AFTER INSERT ON ik_door_apply_failures BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'import-failure:'||plan_id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),NULL),'ik_door_apply_failures',CAST(unixepoch('subsec')*1000 AS INTEGER),'import.failed','workspace',1,'Reviewed import failed','failed',1 FROM ik_door_apply_failures WHERE plan_id=NEW.plan_id AND (1);
END;
CREATE TRIGGER nook_audit_19_insert AFTER INSERT ON nook_group_conversions BEGIN
 INSERT OR IGNORE INTO nook_audit SELECT 'conversion:'||source,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),actor),'nook_group_conversions',CAST(round((julianday(created)-2440587.5)*86400000) AS INTEGER),'channel.converted',destination,1,'Group conversation converted without widening its audience','confirmed',1 FROM nook_group_conversions WHERE source=NEW.source AND (1);
END;
CREATE TRIGGER nook_audit_oa_operators_change AFTER UPDATE ON oa_operators WHEN OLD.role<>NEW.role OR OLD.status<>NEW.status BEGIN
 INSERT INTO nook_audit VALUES(lower(hex(randomblob(16))),(SELECT actor FROM nook_audit_context WHERE id=1),'oa_operators',CAST(unixepoch('subsec')*1000 AS INTEGER),'authority.role-status','workspace',OLD.version+1,'Role: '||NEW.role||'; status: '||NEW.status,'confirmed',1);
END;
CREATE TRIGGER nook_audit_nook_access_change AFTER UPDATE ON nook_access WHEN OLD.active<>NEW.active OR OLD.mode<>NEW.mode OR OLD.generation<>NEW.generation BEGIN
 INSERT INTO nook_audit VALUES(lower(hex(randomblob(16))),(SELECT actor FROM nook_audit_context WHERE id=1),'nook_access',CAST(unixepoch('subsec')*1000 AS INTEGER),'membership.access','workspace',NEW.generation,'Access: '||NEW.mode||'; active: '||NEW.active,'confirmed',1);
END;
CREATE TRIGGER nook_audit_channel_created AFTER INSERT ON nook_conversations BEGIN
 INSERT OR IGNORE INTO nook_audit VALUES('conversation:'||NEW.id,COALESCE((SELECT actor FROM nook_audit_context WHERE id=1),NEW.owner),'nook_conversations',CAST(unixepoch('subsec')*1000 AS INTEGER),'channel.created',NEW.id,NEW.version,'Conversation created','confirmed',1);
END;
CREATE VIEW nook_audit_log AS WITH history AS MATERIALIZED (SELECT * FROM nook_audit_history) SELECT * FROM nook_audit UNION ALL SELECT h.* FROM history h WHERE NOT EXISTS(SELECT 1 FROM nook_audit a WHERE a.id=h.id);
-- Portability is an existing external step: until the job has completed the
-- outcome is uncertain. A cancelled/interrupted build never becomes confirmed.
CREATE TRIGGER nook_audit_portability_insert AFTER INSERT ON rer_portability_jobs WHEN NEW.kind='export' BEGIN
 INSERT OR IGNORE INTO nook_audit VALUES('archive:'||NEW.id||':'||NEW.phase,CASE WHEN NEW.actor IN (SELECT id FROM nook_actors) THEN NEW.actor ELSE NULL END,'portability',CAST(unixepoch('subsec')*1000 AS INTEGER),'archive.'||NEW.kind||'.'||NEW.phase,'workspace',1,'Archive operation started; completion unconfirmed','uncertain',1);
END;
CREATE TRIGGER nook_audit_portability_phase AFTER UPDATE OF phase ON rer_portability_jobs WHEN NEW.phase<>OLD.phase AND (NEW.kind='export' OR NEW.phase='complete') BEGIN
 INSERT OR IGNORE INTO nook_audit VALUES('archive:'||NEW.id||':'||NEW.phase,(SELECT actor FROM nook_audit_context WHERE id=1),'portability',CAST(unixepoch('subsec')*1000 AS INTEGER),'archive.'||NEW.kind||'.'||NEW.phase,'workspace',1,CASE WHEN NEW.phase='complete' THEN 'Archive operation complete' ELSE 'Archive operation interrupted or in progress; completion unconfirmed' END,CASE WHEN NEW.phase='complete' THEN 'confirmed' ELSE 'uncertain' END,1);
END;
CREATE TRIGGER nook_audit_import_settings AFTER UPDATE OF enabled ON ik_door_settings WHEN OLD.enabled<>NEW.enabled BEGIN
 INSERT INTO nook_audit VALUES(lower(hex(randomblob(16))),(SELECT actor FROM nook_audit_context WHERE id=1),'import-door',CAST(unixepoch('subsec')*1000 AS INTEGER),'policy.import-door','workspace',1,CASE NEW.enabled WHEN 1 THEN 'Signed import door enabled' ELSE 'Signed import door disabled' END,'confirmed',1);
END;
CREATE TRIGGER nook_audit_import_revoke AFTER INSERT ON ik_door_revoked_keys BEGIN
 INSERT INTO nook_audit VALUES(lower(hex(randomblob(16))),(SELECT actor FROM nook_audit_context WHERE id=1),'import-door',CAST(unixepoch('subsec')*1000 AS INTEGER),'policy.import-key-revoked','workspace',1,'Import signing authority revoked','confirmed',1);
END;
-- Erasure is the sole product operation that changes attribution; facts remain.
CREATE TRIGGER nook_audit_actor_erased AFTER DELETE ON nook_actors BEGIN
 UPDATE nook_audit SET actor=NULL WHERE actor=OLD.id;
END;
ALTER TABLE nook_exit_jobs ADD COLUMN audit_max INTEGER NOT NULL DEFAULT 0;
