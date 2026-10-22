-- A forward grants a shown snapshot or a link, never source conversation access.
CREATE TABLE nook_forward_policy(id INTEGER PRIMARY KEY CHECK(id=1),mode TEXT NOT NULL CHECK(mode IN ('allow','link-only','blocked')),version INTEGER NOT NULL);
CREATE TABLE nook_forwards(message TEXT PRIMARY KEY,conversation TEXT NOT NULL,source TEXT NOT NULL,source_conversation TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN ('link','show')),note TEXT NOT NULL,intent TEXT NOT NULL,request_hash TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX nook_forward_source ON nook_forwards(source);
CREATE TABLE nook_forward_files(attachment TEXT PRIMARY KEY,source_attachment TEXT NOT NULL,message TEXT NOT NULL,conversation TEXT NOT NULL);
CREATE INDEX nook_forward_file_source ON nook_forward_files(source_attachment);
CREATE TRIGGER nook_forward_exit_insert AFTER INSERT ON nook_forwards BEGIN INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_forward_exit_delete AFTER DELETE ON nook_forwards BEGIN INSERT INTO nook_exit_changes VALUES(OLD.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
-- A body-free replay event refreshes every descendant copy after a source edit.
CREATE TRIGGER nook_forward_edit AFTER UPDATE OF body ON nook_messages WHEN NEW.body<>OLD.body BEGIN
 UPDATE nook_conversations SET seq=seq+1 WHERE id IN (WITH RECURSIVE copies(message,conversation) AS (SELECT message,conversation FROM nook_forwards WHERE source=NEW.id UNION SELECT f.message,f.conversation FROM nook_forwards f JOIN copies c ON f.source=c.message) SELECT conversation FROM copies);
 INSERT INTO nook_events SELECT c.id,c.seq,'edit',(SELECT min(f.message) FROM nook_forwards f WHERE f.conversation=c.id),NULL FROM nook_conversations c WHERE c.id IN (WITH RECURSIVE copies(message,conversation) AS (SELECT message,conversation FROM nook_forwards WHERE source=NEW.id UNION SELECT f.message,f.conversation FROM nook_forwards f JOIN copies c ON f.source=c.message) SELECT conversation FROM copies);
END;
