-- NOOK-082 extends the existing schedule payload, runner and occurrence ledger.
-- No source body or attachment snapshot is held until the ordinary forward door
-- delivers. Source erasure cancels pending work and removes its derived request.
CREATE TRIGGER nook_scheduled_forward_source_delete BEFORE DELETE ON nook_messages BEGIN
 UPDATE nook_schedules SET state='cancelled',version=version+1,reason='Forward source was erased',
 payload=json_set(json_remove(payload,'$.forward'),'$.forwardErased',json('true')),definition=json_set(json_remove(definition,'$.payload.forward'),'$.payload.forwardErased',json('true'))
 WHERE json_extract(payload,'$.forward.source')=OLD.id;
END;
CREATE TRIGGER nook_scheduled_forward_import_delete BEFORE DELETE ON nook_import_records BEGIN
 UPDATE nook_schedules SET state='cancelled',version=version+1,reason='Forward source was erased',
 payload=json_set(json_remove(payload,'$.forward'),'$.forwardErased',json('true')),definition=json_set(json_remove(definition,'$.payload.forward'),'$.payload.forwardErased',json('true'))
 WHERE json_extract(payload,'$.forward.source')=OLD.id;
END;
CREATE TRIGGER nook_scheduled_forward_exit_insert AFTER INSERT ON nook_schedules BEGIN
 INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER nook_scheduled_forward_exit_update AFTER UPDATE ON nook_schedules BEGIN
 INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER nook_scheduled_forward_exit_delete AFTER DELETE ON nook_schedules BEGIN
 INSERT INTO nook_exit_changes VALUES(OLD.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1;
END;
