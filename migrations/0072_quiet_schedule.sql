-- Recipient-owned wall-clock quiet rules. Queue deadlines are derived from
-- local calendar boundaries, never an elapsed 24-hour recurrence.
CREATE TABLE nook_quiet_schedules(
 user TEXT PRIMARY KEY,enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 zone TEXT NOT NULL,days_json TEXT NOT NULL CHECK(json_valid(days_json)),
 version INTEGER NOT NULL CHECK(version>0),updated INTEGER NOT NULL,
 quiet_until INTEGER NOT NULL DEFAULT 0,next_change INTEGER
);
CREATE INDEX nook_quiet_transition ON nook_quiet_schedules(next_change) WHERE enabled=1;
