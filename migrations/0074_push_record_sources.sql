-- NOOK-015/073: source-linked, body-free routing history. Never infer an
-- outcome's causing actor from its author: completion can be another person.
ALTER TABLE nook_push_delivery_records ADD COLUMN message TEXT;
ALTER TABLE nook_push_delivery_records ADD COLUMN outcome TEXT;
ALTER TABLE nook_push_delivery_records ADD COLUMN attention TEXT;
ALTER TABLE nook_push_delivery_records ADD COLUMN actor TEXT;
ALTER TABLE nook_push_delivery_records ADD COLUMN source_version INTEGER;
ALTER TABLE nook_push_delivery_records ADD COLUMN holds TEXT NOT NULL DEFAULT '[]';
ALTER TABLE nook_push_delivery_records ADD COLUMN legacy INTEGER NOT NULL DEFAULT 0;
DROP TRIGGER nook_push_delivery_record_insert;
DROP TRIGGER nook_push_delivery_record_update;
UPDATE nook_push_delivery_records AS r SET
 message=COALESCE((SELECT message FROM nook_notify_queue WHERE id=r.id),(SELECT id FROM nook_message_history m WHERE r.id='push:'||m.id||':'||r.user||':'||r.device)),
 outcome=COALESCE((SELECT outcome FROM nook_notify_queue WHERE id=r.id),(SELECT id FROM nook_outcome_history o WHERE substr(r.id,6,length(o.id)+1)=o.id||'.')),
 attention=(SELECT attention FROM nook_notify_queue WHERE id=r.id),
 actor=(SELECT actor FROM nook_notify_queue WHERE id=r.id),legacy=1;
UPDATE nook_push_delivery_records AS r SET
 source_version=CASE WHEN outcome IS NOT NULL THEN CAST(substr(r.id,length(outcome)+7,instr(substr(r.id,length(outcome)+7),'.')-1) AS INTEGER) END,
 actor=COALESCE(actor,(SELECT author FROM nook_message_history WHERE id=r.message));
UPDATE nook_push_delivery_records AS r SET
 actor=COALESCE(actor,(SELECT actor FROM nook_outcome_versions WHERE outcome=r.outcome AND version=r.source_version)),
 attention=COALESCE(attention,CASE WHEN outcome IS NOT NULL THEN outcome||'.'||source_version||'.'||user END),
 holds=CASE WHEN held_at IS NULL THEN '[]' ELSE json_array(json_object('kind','legacy-activity-or-mobile-delay','start',held_at,'release',released_at)) END;
-- Erased-source records are not structural tombstones and must not survive an
-- upgrade. Ordinary deleted-message tombstones and removed devices remain valid.
DELETE FROM nook_push_delivery_records AS r WHERE
 EXISTS(SELECT 1 FROM nook_erased_actors WHERE id=r.user OR id=r.actor)
 OR EXISTS(SELECT 1 FROM nook_erased_messages WHERE id=r.message)
 OR EXISTS(SELECT 1 FROM nook_erased_outcomes WHERE id=r.outcome)
 OR EXISTS(SELECT 1 FROM nook_erased_outcome_actions WHERE outcome=r.outcome AND version=r.source_version);
-- Before 0074, conversion moved source objects and queues but not retained
-- routing records. Follow its durable mapping before validating source scope.
UPDATE nook_push_delivery_records AS r SET conversation=(
 SELECT destination FROM nook_group_conversions WHERE source=r.conversation
) WHERE EXISTS(SELECT 1 FROM nook_group_conversions WHERE source=r.conversation);
-- A missing source or actor is not evidence that an old row is safe. Refuse the
-- upgrade atomically rather than inventing history or deleting unrelated rows.
CREATE TABLE nook_delivery_source_guard(value INTEGER CONSTRAINT ambiguous_delivery_source CHECK(value=0));
INSERT INTO nook_delivery_source_guard SELECT count(*) FROM nook_push_delivery_records r WHERE
 NOT EXISTS(SELECT 1 FROM nook_actors WHERE id=r.user) OR NOT EXISTS(SELECT 1 FROM nook_actors WHERE id=r.actor)
 OR (r.message IS NULL)=(r.outcome IS NULL)
 OR r.message IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nook_messages WHERE id=r.message AND author=r.actor AND conversation=r.conversation)
 OR r.outcome IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nook_outcomes o JOIN nook_outcome_versions v ON v.outcome=o.id WHERE o.id=r.outcome AND o.conversation=r.conversation AND v.version=r.source_version AND v.actor=r.actor AND r.id='push:'||o.id||'.'||v.version||'.'||r.user||':'||r.device);
DROP TABLE nook_delivery_source_guard;
CREATE INDEX nook_push_record_message ON nook_push_delivery_records(message);
CREATE INDEX nook_push_record_outcome ON nook_push_delivery_records(outcome);
CREATE INDEX nook_push_record_actor ON nook_push_delivery_records(actor);
CREATE TRIGGER nook_push_delivery_record_insert AFTER INSERT ON nook_notify_queue WHEN NEW.channel='push' AND NOT EXISTS(SELECT 1 FROM nook_erased_actors WHERE id=NEW.user OR id=NEW.actor) AND NOT EXISTS(SELECT 1 FROM nook_erased_messages WHERE id=NEW.message) AND NOT EXISTS(SELECT 1 FROM nook_erased_outcomes WHERE id=NEW.outcome) AND NOT EXISTS(SELECT 1 FROM nook_erased_outcome_actions WHERE NEW.attention=outcome||'.'||version||'.'||NEW.user) AND (NEW.held_at IS NOT NULL OR NEW.state='cancelled' OR EXISTS(SELECT 1 FROM nook_push_delivery_records WHERE id=NEW.id) OR EXISTS(SELECT 'activity' AS kind,CASE WHEN COALESCE((SELECT legacy FROM nook_push_delivery_records WHERE id=NEW.id),0)=1 OR EXISTS(SELECT 1 FROM nook_push_delivery_records r,json_each(r.holds) h WHERE r.id=NEW.id AND json_extract(h.value,'$.kind')='activity') THEN NEW.updated ELSE NEW.held_at END AS start WHERE NEW.held_at IS NOT NULL AND NEW.released_at IS NULL AND NEW.active_until>NEW.updated UNION ALL SELECT 'mobile-delay' AS kind,CASE WHEN COALESCE((SELECT legacy FROM nook_push_delivery_records WHERE id=NEW.id),0)=1 THEN NEW.updated ELSE max(NEW.created,NEW.active_until) END AS start WHERE NEW.held_at IS NOT NULL AND NEW.released_at IS NULL AND NEW.active_until<=NEW.updated AND NEW.active_until+COALESCE((SELECT mobile_delay_minutes*60000 FROM nook_notify_preferences WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'quiet-schedule' AS kind,NEW.updated AS start WHERE NOT(NEW.reason='urgent-request' AND COALESCE((SELECT push_urgent_quiet FROM nook_notify_preferences WHERE user=NEW.user),0)=1) AND COALESCE((SELECT quiet_until FROM nook_quiet_schedules WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'quiet-snooze' AS kind,NEW.updated AS start WHERE NOT(NEW.reason='urgent-request' AND COALESCE((SELECT push_urgent_quiet FROM nook_notify_preferences WHERE user=NEW.user),0)=1) AND COALESCE((SELECT dnd_until FROM nook_settings WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'item-snooze' AS kind,NEW.updated AS start WHERE EXISTS(SELECT 1 FROM nook_attention WHERE id=NEW.attention AND state='snoozed' AND snooze_until>NEW.updated))) BEGIN
 INSERT INTO nook_push_delivery_records(id,user,conversation,device,device_name,reason,state,error,created,updated,held_at,released_at,message,outcome,attention,actor,source_version,holds,legacy) SELECT NEW.id,NEW.user,NEW.conversation,NEW.device,COALESCE((SELECT name FROM nook_push_devices WHERE id=NEW.device),(SELECT device_name FROM nook_push_delivery_records WHERE id=NEW.id),'Removed device'),NEW.reason,NEW.state,NEW.error,NEW.created,NEW.updated,NEW.held_at,NEW.released_at,NEW.message,NEW.outcome,NEW.attention,NEW.actor,CASE WHEN NEW.outcome IS NOT NULL THEN CAST(substr(NEW.attention,length(NEW.outcome)+2,instr(substr(NEW.attention,length(NEW.outcome)+2),'.')-1) AS INTEGER) END,(WITH current AS (SELECT 'activity' AS kind,CASE WHEN COALESCE((SELECT legacy FROM nook_push_delivery_records WHERE id=NEW.id),0)=1 OR EXISTS(SELECT 1 FROM nook_push_delivery_records r,json_each(r.holds) h WHERE r.id=NEW.id AND json_extract(h.value,'$.kind')='activity') THEN NEW.updated ELSE NEW.held_at END AS start WHERE NEW.held_at IS NOT NULL AND NEW.released_at IS NULL AND NEW.active_until>NEW.updated UNION ALL SELECT 'mobile-delay' AS kind,CASE WHEN COALESCE((SELECT legacy FROM nook_push_delivery_records WHERE id=NEW.id),0)=1 THEN NEW.updated ELSE max(NEW.created,NEW.active_until) END AS start WHERE NEW.held_at IS NOT NULL AND NEW.released_at IS NULL AND NEW.active_until<=NEW.updated AND NEW.active_until+COALESCE((SELECT mobile_delay_minutes*60000 FROM nook_notify_preferences WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'quiet-schedule' AS kind,NEW.updated AS start WHERE NOT(NEW.reason='urgent-request' AND COALESCE((SELECT push_urgent_quiet FROM nook_notify_preferences WHERE user=NEW.user),0)=1) AND COALESCE((SELECT quiet_until FROM nook_quiet_schedules WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'quiet-snooze' AS kind,NEW.updated AS start WHERE NOT(NEW.reason='urgent-request' AND COALESCE((SELECT push_urgent_quiet FROM nook_notify_preferences WHERE user=NEW.user),0)=1) AND COALESCE((SELECT dnd_until FROM nook_settings WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'item-snooze' AS kind,NEW.updated AS start WHERE EXISTS(SELECT 1 FROM nook_attention WHERE id=NEW.attention AND state='snoozed' AND snooze_until>NEW.updated)), old AS (SELECT value FROM json_each(COALESCE((SELECT holds FROM nook_push_delivery_records WHERE id=NEW.id),'[]'))), intervals AS (
 SELECT CASE WHEN json_extract(value,'$.release') IS NULL AND (NEW.state NOT IN ('pending','retrying') OR NOT EXISTS(SELECT 1 FROM current WHERE kind=json_extract(value,'$.kind'))) THEN json_set(value,'$.release',CASE WHEN json_extract(value,'$.kind')='activity' AND NEW.active_until>=json_extract(value,'$.start') THEN min(NEW.updated,NEW.active_until) ELSE NEW.updated END) ELSE value END AS value FROM old
 UNION ALL SELECT json_object('kind',kind,'start',start,'release',CASE WHEN NEW.state NOT IN ('pending','retrying') THEN NEW.updated END) FROM current WHERE NOT EXISTS(SELECT 1 FROM old WHERE json_extract(value,'$.kind')=kind AND json_extract(value,'$.release') IS NULL)
 ) SELECT json_group_array(json(value)) FROM intervals),0
 ON CONFLICT(id) DO UPDATE SET state=excluded.state,error=excluded.error,updated=excluded.updated,held_at=excluded.held_at,released_at=excluded.released_at,holds=excluded.holds;
END;
CREATE TRIGGER nook_push_delivery_record_update AFTER UPDATE ON nook_notify_queue WHEN NEW.channel='push' AND OLD.state IN ('pending','sending','retrying') AND NOT EXISTS(SELECT 1 FROM nook_erased_actors WHERE id=NEW.user OR id=NEW.actor) AND NOT EXISTS(SELECT 1 FROM nook_erased_messages WHERE id=NEW.message) AND NOT EXISTS(SELECT 1 FROM nook_erased_outcomes WHERE id=NEW.outcome) AND NOT EXISTS(SELECT 1 FROM nook_erased_outcome_actions WHERE NEW.attention=outcome||'.'||version||'.'||NEW.user) AND (NEW.held_at IS NOT NULL OR NEW.state='cancelled' OR EXISTS(SELECT 1 FROM nook_push_delivery_records WHERE id=NEW.id) OR EXISTS(SELECT 'activity' AS kind,CASE WHEN COALESCE((SELECT legacy FROM nook_push_delivery_records WHERE id=NEW.id),0)=1 OR EXISTS(SELECT 1 FROM nook_push_delivery_records r,json_each(r.holds) h WHERE r.id=NEW.id AND json_extract(h.value,'$.kind')='activity') THEN NEW.updated ELSE NEW.held_at END AS start WHERE NEW.held_at IS NOT NULL AND NEW.released_at IS NULL AND NEW.active_until>NEW.updated UNION ALL SELECT 'mobile-delay' AS kind,CASE WHEN COALESCE((SELECT legacy FROM nook_push_delivery_records WHERE id=NEW.id),0)=1 THEN NEW.updated ELSE max(NEW.created,NEW.active_until) END AS start WHERE NEW.held_at IS NOT NULL AND NEW.released_at IS NULL AND NEW.active_until<=NEW.updated AND NEW.active_until+COALESCE((SELECT mobile_delay_minutes*60000 FROM nook_notify_preferences WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'quiet-schedule' AS kind,NEW.updated AS start WHERE NOT(NEW.reason='urgent-request' AND COALESCE((SELECT push_urgent_quiet FROM nook_notify_preferences WHERE user=NEW.user),0)=1) AND COALESCE((SELECT quiet_until FROM nook_quiet_schedules WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'quiet-snooze' AS kind,NEW.updated AS start WHERE NOT(NEW.reason='urgent-request' AND COALESCE((SELECT push_urgent_quiet FROM nook_notify_preferences WHERE user=NEW.user),0)=1) AND COALESCE((SELECT dnd_until FROM nook_settings WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'item-snooze' AS kind,NEW.updated AS start WHERE EXISTS(SELECT 1 FROM nook_attention WHERE id=NEW.attention AND state='snoozed' AND snooze_until>NEW.updated))) BEGIN
 INSERT INTO nook_push_delivery_records(id,user,conversation,device,device_name,reason,state,error,created,updated,held_at,released_at,message,outcome,attention,actor,source_version,holds,legacy) SELECT NEW.id,NEW.user,NEW.conversation,NEW.device,COALESCE((SELECT name FROM nook_push_devices WHERE id=NEW.device),(SELECT device_name FROM nook_push_delivery_records WHERE id=NEW.id),'Removed device'),NEW.reason,NEW.state,NEW.error,NEW.created,NEW.updated,NEW.held_at,NEW.released_at,NEW.message,NEW.outcome,NEW.attention,NEW.actor,CASE WHEN NEW.outcome IS NOT NULL THEN CAST(substr(NEW.attention,length(NEW.outcome)+2,instr(substr(NEW.attention,length(NEW.outcome)+2),'.')-1) AS INTEGER) END,(WITH current AS (SELECT 'activity' AS kind,CASE WHEN COALESCE((SELECT legacy FROM nook_push_delivery_records WHERE id=NEW.id),0)=1 OR EXISTS(SELECT 1 FROM nook_push_delivery_records r,json_each(r.holds) h WHERE r.id=NEW.id AND json_extract(h.value,'$.kind')='activity') THEN NEW.updated ELSE NEW.held_at END AS start WHERE NEW.held_at IS NOT NULL AND NEW.released_at IS NULL AND NEW.active_until>NEW.updated UNION ALL SELECT 'mobile-delay' AS kind,CASE WHEN COALESCE((SELECT legacy FROM nook_push_delivery_records WHERE id=NEW.id),0)=1 THEN NEW.updated ELSE max(NEW.created,NEW.active_until) END AS start WHERE NEW.held_at IS NOT NULL AND NEW.released_at IS NULL AND NEW.active_until<=NEW.updated AND NEW.active_until+COALESCE((SELECT mobile_delay_minutes*60000 FROM nook_notify_preferences WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'quiet-schedule' AS kind,NEW.updated AS start WHERE NOT(NEW.reason='urgent-request' AND COALESCE((SELECT push_urgent_quiet FROM nook_notify_preferences WHERE user=NEW.user),0)=1) AND COALESCE((SELECT quiet_until FROM nook_quiet_schedules WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'quiet-snooze' AS kind,NEW.updated AS start WHERE NOT(NEW.reason='urgent-request' AND COALESCE((SELECT push_urgent_quiet FROM nook_notify_preferences WHERE user=NEW.user),0)=1) AND COALESCE((SELECT dnd_until FROM nook_settings WHERE user=NEW.user),0)>NEW.updated UNION ALL SELECT 'item-snooze' AS kind,NEW.updated AS start WHERE EXISTS(SELECT 1 FROM nook_attention WHERE id=NEW.attention AND state='snoozed' AND snooze_until>NEW.updated)), old AS (SELECT value FROM json_each(COALESCE((SELECT holds FROM nook_push_delivery_records WHERE id=NEW.id),'[]'))), intervals AS (
 SELECT CASE WHEN json_extract(value,'$.release') IS NULL AND (NEW.state NOT IN ('pending','retrying') OR NOT EXISTS(SELECT 1 FROM current WHERE kind=json_extract(value,'$.kind'))) THEN json_set(value,'$.release',CASE WHEN json_extract(value,'$.kind')='activity' AND NEW.active_until>=json_extract(value,'$.start') THEN min(NEW.updated,NEW.active_until) ELSE NEW.updated END) ELSE value END AS value FROM old
 UNION ALL SELECT json_object('kind',kind,'start',start,'release',CASE WHEN NEW.state NOT IN ('pending','retrying') THEN NEW.updated END) FROM current WHERE NOT EXISTS(SELECT 1 FROM old WHERE json_extract(value,'$.kind')=kind AND json_extract(value,'$.release') IS NULL)
 ) SELECT json_group_array(json(value)) FROM intervals),0
 ON CONFLICT(id) DO UPDATE SET state=excluded.state,error=excluded.error,updated=excluded.updated,held_at=excluded.held_at,released_at=excluded.released_at,holds=excluded.holds;
END;
UPDATE nook_notify_queue SET updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND state IN ('pending','retrying');

-- Public preference and triage transactions observe holds immediately, even if
-- a read cancels the row before the alarm first runs.
CREATE TRIGGER nook_push_item_hold AFTER UPDATE OF state,snooze_until ON nook_attention BEGIN
 UPDATE nook_notify_queue SET updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND attention=NEW.id AND state IN ('pending','retrying');
END;
CREATE TRIGGER nook_push_dnd_until_insert AFTER INSERT ON nook_settings BEGIN
 UPDATE nook_notify_queue SET updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND user=NEW.user AND state IN ('pending','retrying');
END;
CREATE TRIGGER nook_push_dnd_until_update AFTER UPDATE ON nook_settings BEGIN
 UPDATE nook_notify_queue SET updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND user=NEW.user AND state IN ('pending','retrying');
END;
CREATE TRIGGER nook_push_quiet_until_insert AFTER INSERT ON nook_quiet_schedules BEGIN
 UPDATE nook_notify_queue SET updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND user=NEW.user AND state IN ('pending','retrying');
END;
CREATE TRIGGER nook_push_quiet_until_update AFTER UPDATE ON nook_quiet_schedules BEGIN
 UPDATE nook_notify_queue SET updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND user=NEW.user AND state IN ('pending','retrying');
END;
DROP TRIGGER nook_push_device_delete;
CREATE TRIGGER nook_push_device_delete AFTER DELETE ON nook_push_devices BEGIN
 DELETE FROM nook_push_presence WHERE device=OLD.id;
 UPDATE nook_notify_queue SET state='cancelled',error='device-removed',updated=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE channel='push' AND device=OLD.id AND state IN ('pending','retrying');
END;
