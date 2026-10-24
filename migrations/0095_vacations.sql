CREATE TABLE nook_vacations(user TEXT PRIMARY KEY,starts INTEGER NOT NULL,ends INTEGER NOT NULL,CHECK(starts<ends));
