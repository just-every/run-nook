-- Creator attribution stays immutable. A missing settings row inherits that
-- creator as manager; an explicit NULL records a vacant management position.
CREATE TABLE nook_channel_settings(
 conversation TEXT PRIMARY KEY REFERENCES nook_conversations(id),
 manager TEXT,
 topic TEXT NOT NULL DEFAULT '' CHECK(length(topic)<=500),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
);
CREATE TABLE nook_channel_actions(
 id TEXT PRIMARY KEY,
 conversation TEXT NOT NULL REFERENCES nook_conversations(id),
 version INTEGER NOT NULL CHECK(version>0),
 sequence INTEGER NOT NULL CHECK(sequence>0),
 action TEXT NOT NULL CHECK(action IN ('update','transfer','archive','restore','leave','vacate')),
 actor TEXT,
 subject TEXT,
 created TEXT NOT NULL,
 UNIQUE(conversation,version),
 UNIQUE(conversation,sequence)
);
CREATE INDEX nook_channel_action_history ON nook_channel_actions(conversation,version);
