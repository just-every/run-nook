CREATE TABLE nook_posting_policy(
 conversation TEXT PRIMARY KEY REFERENCES nook_conversations(id),
 level TEXT NOT NULL CHECK(level IN ('everyone','admins','managers','selected')),
 replies TEXT NOT NULL CHECK(replies IN ('everyone','same'))
);
CREATE TABLE nook_posting_people(
 conversation TEXT NOT NULL REFERENCES nook_conversations(id),
 user TEXT NOT NULL,
 PRIMARY KEY(conversation,user)
);
CREATE TABLE nook_posting_changes(
 action TEXT PRIMARY KEY REFERENCES nook_channel_actions(id),
 level TEXT NOT NULL CHECK(level IN ('everyone','admins','managers','selected')),
 replies TEXT NOT NULL CHECK(replies IN ('everyone','same')),
 people INTEGER NOT NULL CHECK(people>=0)
);
