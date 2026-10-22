-- A clip reuses its native attachment bytes and source-message audience.
-- Only transcript corrections create rows. No provider state or retention grant.
CREATE TABLE nook_clips(
 attachment TEXT PRIMARY KEY REFERENCES nook_attachments(id) ON DELETE CASCADE,
 message TEXT NOT NULL REFERENCES nook_messages(id) ON DELETE CASCADE,
 conversation TEXT NOT NULL REFERENCES nook_conversations(id),
 version INTEGER NOT NULL CHECK(version>=1),created TEXT NOT NULL,
 UNIQUE(attachment,message,conversation)
);
CREATE INDEX nook_clips_message ON nook_clips(message);
CREATE INDEX nook_clips_conversation ON nook_clips(conversation,attachment);
CREATE TABLE nook_clip_transcripts(
 attachment TEXT NOT NULL,message TEXT NOT NULL,conversation TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>=1),actor TEXT,created TEXT NOT NULL,
 format TEXT NOT NULL CHECK(format IN ('typed','webvtt')),language TEXT NOT NULL,
 cues_json TEXT NOT NULL CHECK(json_valid(cues_json) AND json_type(cues_json)='array'),
 PRIMARY KEY(attachment,version),
 FOREIGN KEY(attachment,message,conversation) REFERENCES nook_clips(attachment,message,conversation) ON DELETE CASCADE
);
CREATE INDEX nook_clip_transcripts_actor ON nook_clip_transcripts(actor);
CREATE INDEX nook_clip_transcripts_message ON nook_clip_transcripts(message);
CREATE TRIGGER nook_clip_transcript_immutable BEFORE UPDATE ON nook_clip_transcripts
 WHEN NEW.attachment IS NOT OLD.attachment OR NEW.message IS NOT OLD.message OR NEW.conversation IS NOT OLD.conversation OR NEW.version IS NOT OLD.version OR NEW.created IS NOT OLD.created OR NEW.format IS NOT OLD.format OR NEW.language IS NOT OLD.language OR NEW.cues_json IS NOT OLD.cues_json OR (NEW.actor IS NOT OLD.actor AND NEW.actor IS NOT NULL)
 BEGIN SELECT RAISE(ABORT,'Transcript corrections require a new version'); END;
-- Explicit deletes also work in maintenance contexts without FK enforcement.
-- Erasure callers must collect portability row keys BEFORE these triggers run.
CREATE TRIGGER nook_clip_attachment_delete BEFORE DELETE ON nook_attachments BEGIN
 DELETE FROM nook_clip_transcripts WHERE attachment=OLD.id;
 DELETE FROM nook_clips WHERE attachment=OLD.id;
END;
CREATE TRIGGER nook_clip_message_delete BEFORE DELETE ON nook_messages BEGIN
 DELETE FROM nook_clip_transcripts WHERE message=OLD.id;
 DELETE FROM nook_clips WHERE message=OLD.id;
END;
CREATE TRIGGER nook_clip_delete BEFORE DELETE ON nook_clips BEGIN
 DELETE FROM nook_clip_transcripts WHERE attachment=OLD.attachment;
END;
CREATE TRIGGER nook_clip_actor_delete BEFORE DELETE ON nook_actors BEGIN
 UPDATE nook_clip_transcripts SET actor=NULL WHERE actor=OLD.id;
END;
CREATE TRIGGER nook_clips_exit_insert AFTER INSERT ON nook_clips BEGIN
 INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER nook_clips_exit_delete AFTER DELETE ON nook_clips BEGIN
 INSERT INTO nook_exit_changes VALUES(OLD.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER nook_clip_transcripts_exit_insert AFTER INSERT ON nook_clip_transcripts BEGIN
 INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER nook_clip_transcripts_exit_update AFTER UPDATE ON nook_clip_transcripts BEGIN
 INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER nook_clip_transcripts_exit_delete AFTER DELETE ON nook_clip_transcripts BEGIN
 INSERT INTO nook_exit_changes VALUES(OLD.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1;
END;
-- Import undo tombstones disclosed native file copies in place.
CREATE TRIGGER nook_clip_file_tombstone BEFORE UPDATE OF state ON nook_attachments WHEN NEW.state='deleted' BEGIN
 DELETE FROM nook_clip_transcripts WHERE attachment=OLD.id;
 DELETE FROM nook_clips WHERE attachment=OLD.id;
END;
