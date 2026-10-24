ALTER TABLE nook_notify_preferences ADD COLUMN away_email INTEGER NOT NULL DEFAULT 0 CHECK(away_email IN (0,1));
ALTER TABLE nook_notify_preferences ADD COLUMN away_interval INTEGER NOT NULL DEFAULT 15 CHECK(away_interval IN (15,60));
ALTER TABLE nook_notify_preferences ADD COLUMN email_offer_seen INTEGER NOT NULL DEFAULT 1 CHECK(email_offer_seen IN (0,1));
CREATE TABLE nook_notification_defaults(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,push_json TEXT NOT NULL,channels_json TEXT NOT NULL,away_email INTEGER NOT NULL CHECK(away_email IN (0,1)));
