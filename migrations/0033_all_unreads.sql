-- Reversible, account-owned read operations. Generation fences preserve later reads.
CREATE TABLE nook_read_generations(conversation TEXT NOT NULL,user TEXT NOT NULL,generation INTEGER NOT NULL,PRIMARY KEY(conversation,user));
CREATE TRIGGER nook_read_insert AFTER INSERT ON nook_reads BEGIN
 INSERT INTO nook_read_generations VALUES(NEW.conversation,NEW.user,1) ON CONFLICT(conversation,user) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER nook_read_update AFTER UPDATE ON nook_reads BEGIN
 INSERT INTO nook_read_generations VALUES(NEW.conversation,NEW.user,1) ON CONFLICT(conversation,user) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER nook_thread_read_insert AFTER INSERT ON nook_thread_reads BEGIN
 INSERT INTO nook_read_generations SELECT conversation,NEW.user,1 FROM nook_message_history WHERE id=NEW.message ON CONFLICT(conversation,user) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER nook_thread_read_update AFTER UPDATE ON nook_thread_reads BEGIN
 INSERT INTO nook_read_generations SELECT conversation,NEW.user,1 FROM nook_message_history WHERE id=NEW.message ON CONFLICT(conversation,user) DO UPDATE SET generation=generation+1;
END;
CREATE TABLE nook_read_undo(id TEXT PRIMARY KEY,user TEXT NOT NULL,expires INTEGER NOT NULL,snapshot TEXT NOT NULL CHECK(json_valid(snapshot)));
