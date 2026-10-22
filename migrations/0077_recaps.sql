-- Recaps persist only member feedback, never generated answers or credentials.
CREATE TABLE nook_recap_feedback(id TEXT PRIMARY KEY,user TEXT NOT NULL,conversation TEXT NOT NULL,message TEXT NOT NULL,recap TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('correction','dismissal')),correction TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TRIGGER nook_recap_feedback_message AFTER DELETE ON nook_messages BEGIN DELETE FROM nook_recap_feedback WHERE message=OLD.id; END;
CREATE TRIGGER nook_recap_feedback_import AFTER DELETE ON nook_import_records BEGIN DELETE FROM nook_recap_feedback WHERE message=OLD.id; END;
CREATE TRIGGER nook_recap_feedback_exit_insert AFTER INSERT ON nook_recap_feedback BEGIN INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_recap_feedback_exit_delete AFTER DELETE ON nook_recap_feedback BEGIN INSERT INTO nook_exit_changes VALUES(OLD.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
