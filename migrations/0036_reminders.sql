CREATE TABLE nook_reminders (
 id TEXT PRIMARY KEY, user TEXT NOT NULL, recipient TEXT NOT NULL,
 conversation TEXT, source_kind TEXT, source TEXT,
 text TEXT NOT NULL, local_at TEXT NOT NULL, zone TEXT NOT NULL, recurrence TEXT NOT NULL,
 next_due INTEGER NOT NULL, state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 schedule TEXT, reason TEXT, intent TEXT NOT NULL, definition TEXT NOT NULL,
 operator_version INTEGER NOT NULL, access_generation INTEGER NOT NULL,
 created INTEGER NOT NULL, updated INTEGER NOT NULL,
 UNIQUE(user,intent)
);
CREATE INDEX nook_reminders_due ON nook_reminders(state,next_due);
CREATE INDEX nook_reminders_recipient ON nook_reminders(recipient,id);
CREATE TABLE nook_reminder_occurrences (
 reminder TEXT NOT NULL REFERENCES nook_reminders(id), due INTEGER NOT NULL,
 state TEXT NOT NULL, completed INTEGER NOT NULL, message TEXT,
 PRIMARY KEY(reminder,due)
);
