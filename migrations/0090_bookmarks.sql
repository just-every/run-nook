-- Additive upgrade: a channel's bookmarks bar of links, files and one-level folders. A file bookmark names an attached file of the same channel;
-- a link bookmark stores only its URL and is never fetched. The version row makes reordering a versioned write.
CREATE TABLE nook_bookmarks(
 id TEXT PRIMARY KEY,conversation TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('link','file','folder')),
 title TEXT NOT NULL,target TEXT,parent TEXT,position INTEGER NOT NULL,author TEXT,created INTEGER NOT NULL
);
CREATE INDEX nook_bookmarks_channel ON nook_bookmarks(conversation,parent,position);
CREATE TABLE nook_bookmark_versions(conversation TEXT PRIMARY KEY,version INTEGER NOT NULL);
CREATE TRIGGER nook_exit_change_nook_bookmarks_insert AFTER INSERT ON nook_bookmarks BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT NEW.conversation,1 WHERE NEW.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_exit_change_nook_bookmarks_update AFTER UPDATE ON nook_bookmarks BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT OLD.conversation,1 WHERE OLD.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; INSERT INTO nook_exit_changes(conversation,revision) SELECT NEW.conversation,1 WHERE NEW.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_exit_change_nook_bookmarks_delete AFTER DELETE ON nook_bookmarks BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT OLD.conversation,1 WHERE OLD.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
