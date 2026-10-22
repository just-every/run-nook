-- NOOK-036: settings are portable only while off; credentials and cost counters are not.
CREATE TABLE nook_ai_settings(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),model TEXT NOT NULL,base_url TEXT NOT NULL,daily_cap INTEGER NOT NULL CHECK(daily_cap BETWEEN 1 AND 1000),version INTEGER NOT NULL);
CREATE TABLE nook_ai_secrets(id INTEGER PRIMARY KEY CHECK(id=1),sealed TEXT NOT NULL);
CREATE TABLE nook_ai_calls(day TEXT PRIMARY KEY,calls INTEGER NOT NULL);
CREATE TABLE nook_ai_feedback(id TEXT PRIMARY KEY,user TEXT NOT NULL,conversation TEXT NOT NULL,message TEXT NOT NULL,correction TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TRIGGER nook_ai_feedback_message AFTER DELETE ON nook_messages BEGIN DELETE FROM nook_ai_feedback WHERE message=OLD.id; END;
CREATE TRIGGER nook_ai_feedback_import AFTER DELETE ON nook_import_records BEGIN DELETE FROM nook_ai_feedback WHERE message=OLD.id; END;
CREATE TRIGGER nook_ai_feedback_exit_insert AFTER INSERT ON nook_ai_feedback BEGIN INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_ai_feedback_exit_delete AFTER DELETE ON nook_ai_feedback BEGIN INSERT INTO nook_exit_changes VALUES(OLD.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
