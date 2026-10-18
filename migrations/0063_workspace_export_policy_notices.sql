-- The setting, audit and member announcement are committed together.
CREATE TABLE nook_exit_policy_actions(id INTEGER PRIMARY KEY AUTOINCREMENT,version INTEGER NOT NULL,enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),actor TEXT REFERENCES nook_actors(id) ON DELETE SET NULL,created TEXT NOT NULL,recipients INTEGER NOT NULL);
CREATE TABLE nook_exit_policy_notices(user TEXT NOT NULL REFERENCES nook_actors(id) ON DELETE CASCADE,version INTEGER NOT NULL,enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),created TEXT NOT NULL,PRIMARY KEY(user,version));
