-- Additive upgrade: polls attach to a native message, so the question, search, replay, unread and erasure follow the message.
-- A poll is never a decision or a commitment: no outcome row is created. Votes are one set per member, changeable until the poll closes.
CREATE TABLE nook_polls(
 message TEXT PRIMARY KEY,conversation TEXT NOT NULL,creator TEXT,
 multiple INTEGER NOT NULL CHECK(multiple IN (0,1)),anonymous INTEGER NOT NULL CHECK(anonymous=1),voters INTEGER NOT NULL DEFAULT 0 CHECK(voters>=0),
 closes INTEGER,closed_at INTEGER,closed_by TEXT,created INTEGER NOT NULL
);
CREATE INDEX nook_polls_conversation ON nook_polls(conversation);
CREATE TABLE nook_poll_options(message TEXT NOT NULL,position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 20),label TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0 CHECK(count>=0),PRIMARY KEY(message,position));
CREATE TABLE nook_poll_votes(message TEXT NOT NULL,conversation TEXT NOT NULL,voter TEXT NOT NULL,sealed TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(message,voter));
-- Counts are aggregate rows. Vote choices and their person link are AES-GCM custody, excluded from every export.
CREATE INDEX nook_poll_votes_user ON nook_poll_votes(voter);
-- Readable exports pin a per-conversation source revision; a poll or vote change advances it like every other exported table.
CREATE TRIGGER nook_exit_change_nook_polls_insert AFTER INSERT ON nook_polls BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT NEW.conversation,1 WHERE NEW.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_exit_change_nook_polls_update AFTER UPDATE ON nook_polls BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT OLD.conversation,1 WHERE OLD.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; INSERT INTO nook_exit_changes(conversation,revision) SELECT NEW.conversation,1 WHERE NEW.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_exit_change_nook_polls_delete AFTER DELETE ON nook_polls BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT OLD.conversation,1 WHERE OLD.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_exit_change_nook_poll_votes_insert AFTER INSERT ON nook_poll_votes BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT NEW.conversation,1 WHERE NEW.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_exit_change_nook_poll_votes_update AFTER UPDATE ON nook_poll_votes BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT OLD.conversation,1 WHERE OLD.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; INSERT INTO nook_exit_changes(conversation,revision) SELECT NEW.conversation,1 WHERE NEW.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_exit_change_nook_poll_votes_delete AFTER DELETE ON nook_poll_votes BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT OLD.conversation,1 WHERE OLD.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
