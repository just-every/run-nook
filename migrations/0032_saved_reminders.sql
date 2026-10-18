CREATE TABLE nook_saved_reminders(
 saved TEXT PRIMARY KEY REFERENCES nook_saved_items(id) ON DELETE CASCADE,
 user TEXT NOT NULL,
 due INTEGER NOT NULL CHECK(due>0),
 time_zone TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','ready','done','cancelled')),
 reason TEXT CHECK(reason IS NULL OR reason='source-unavailable'),
 updated INTEGER NOT NULL
);
CREATE INDEX nook_saved_reminder_due ON nook_saved_reminders(state,due);
CREATE INDEX nook_saved_reminder_owner ON nook_saved_reminders(user,state,due);
