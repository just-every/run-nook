-- References deliberately have no FKs: erasure and guarded import undo must
-- remove source rows without restoring bodies or blocking on private bookmarks.
CREATE TABLE nook_saved_items (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 user TEXT NOT NULL,
 conversation TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('message','attachment','link')),
 target TEXT NOT NULL CHECK(length(target) BETWEEN 1 AND 2048),
 created TEXT NOT NULL,
 UNIQUE(user,conversation,kind,target)
);
CREATE INDEX nook_saved_personal_page ON nook_saved_items(user,seq DESC);
CREATE INDEX nook_saved_source ON nook_saved_items(kind,target);
CREATE TABLE nook_channel_pins (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 conversation TEXT NOT NULL,
 message TEXT NOT NULL,
 actor TEXT,
 created TEXT NOT NULL,
 UNIQUE(conversation,message)
);
CREATE INDEX nook_pin_channel_page ON nook_channel_pins(conversation,seq DESC);
CREATE INDEX nook_pin_actor ON nook_channel_pins(actor);
