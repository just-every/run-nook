-- Conversation-local notes. Checklist state never confers outcome authority.
CREATE TABLE nook_notes (
 id TEXT PRIMARY KEY,
 conversation TEXT NOT NULL REFERENCES nook_conversations(id),
 thread TEXT,
 author TEXT,
 created TEXT NOT NULL,
 updated TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 items_json TEXT NOT NULL CHECK(json_valid(items_json)),
 links_json TEXT NOT NULL CHECK(json_valid(links_json)),
 pinned INTEGER NOT NULL CHECK(pinned IN (0,1)),
 pinned_by TEXT,
 pinned_at TEXT,
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1))
);
CREATE INDEX nook_notes_scope ON nook_notes(conversation,thread,id);
CREATE INDEX nook_notes_author ON nook_notes(author,id);
CREATE TABLE nook_note_versions (
 note TEXT NOT NULL REFERENCES nook_notes(id),
 version INTEGER NOT NULL CHECK(version>0),
 actor TEXT,
 created TEXT NOT NULL,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 items_json TEXT NOT NULL CHECK(json_valid(items_json)),
 links_json TEXT NOT NULL CHECK(json_valid(links_json)),
 pinned INTEGER NOT NULL CHECK(pinned IN (0,1)),
 pinned_by TEXT,
 pinned_at TEXT,
 deleted INTEGER NOT NULL CHECK(deleted IN (0,1)),
 reverted_from INTEGER,
 PRIMARY KEY(note,version)
);
CREATE INDEX nook_note_version_actor ON nook_note_versions(actor,note);
CREATE TABLE nook_note_proposals (
 outcome TEXT PRIMARY KEY REFERENCES nook_outcomes(id),
 note TEXT NOT NULL REFERENCES nook_notes(id),
 item TEXT NOT NULL,
 note_version INTEGER NOT NULL,
 created TEXT NOT NULL,
 UNIQUE(note,item,note_version),
 FOREIGN KEY(note,note_version) REFERENCES nook_note_versions(note,version)
);

CREATE TRIGGER nook_exit_change_nook_notes_insert AFTER INSERT ON nook_notes BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT NEW.conversation,1 WHERE NEW.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;

CREATE TRIGGER nook_exit_change_nook_notes_update AFTER UPDATE ON nook_notes BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT NEW.conversation,1 WHERE NEW.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;

CREATE TRIGGER nook_exit_change_nook_notes_delete AFTER DELETE ON nook_notes BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT OLD.conversation,1 WHERE OLD.conversation IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;

CREATE TRIGGER nook_exit_change_nook_note_versions_insert AFTER INSERT ON nook_note_versions BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT (SELECT conversation FROM nook_notes WHERE id=NEW.note),1 WHERE (SELECT conversation FROM nook_notes WHERE id=NEW.note) IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;

CREATE TRIGGER nook_exit_change_nook_note_versions_update AFTER UPDATE ON nook_note_versions BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT (SELECT conversation FROM nook_notes WHERE id=NEW.note),1 WHERE (SELECT conversation FROM nook_notes WHERE id=NEW.note) IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;

CREATE TRIGGER nook_exit_change_nook_note_versions_delete AFTER DELETE ON nook_note_versions BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT (SELECT conversation FROM nook_notes WHERE id=OLD.note),1 WHERE (SELECT conversation FROM nook_notes WHERE id=OLD.note) IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;

CREATE TRIGGER nook_exit_change_nook_note_proposals_insert AFTER INSERT ON nook_note_proposals BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT (SELECT conversation FROM nook_notes WHERE id=NEW.note),1 WHERE (SELECT conversation FROM nook_notes WHERE id=NEW.note) IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;

CREATE TRIGGER nook_exit_change_nook_note_proposals_update AFTER UPDATE ON nook_note_proposals BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT (SELECT conversation FROM nook_notes WHERE id=NEW.note),1 WHERE (SELECT conversation FROM nook_notes WHERE id=NEW.note) IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;

CREATE TRIGGER nook_exit_change_nook_note_proposals_delete AFTER DELETE ON nook_note_proposals BEGIN INSERT INTO nook_exit_changes(conversation,revision) SELECT (SELECT conversation FROM nook_notes WHERE id=OLD.note),1 WHERE (SELECT conversation FROM nook_notes WHERE id=OLD.note) IS NOT NULL ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
