-- C14 email notifications. Additive: no rows are written, so every member's
-- email notifications stay off until that member turns them on.
CREATE TABLE nook_notify_preferences(
 user TEXT PRIMARY KEY,
 mentions INTEGER NOT NULL DEFAULT 0 CHECK(mentions IN (0,1)),
 urgent INTEGER NOT NULL DEFAULT 0 CHECK(urgent IN (0,1)),
 urgent_quiet INTEGER NOT NULL DEFAULT 0 CHECK(urgent_quiet IN (0,1)),
 updated INTEGER NOT NULL
);
-- One row per emailable event per recipient (dedupe = the attention item's ID).
-- Opaque references only: no message text, file names or addresses.
CREATE TABLE nook_notify_queue(
 id TEXT PRIMARY KEY,
 dedupe TEXT NOT NULL UNIQUE,
 user TEXT NOT NULL,
 conversation TEXT NOT NULL,
 actor TEXT,
 message TEXT,
 outcome TEXT,
 reason TEXT NOT NULL CHECK(reason IN ('mention','urgent-request','commitment-proposal','commitment-revision','commitment-complete')),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','retrying','sent','folded','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0,
 due INTEGER NOT NULL,
 error TEXT,
 email TEXT,
 token_hash TEXT,
 created INTEGER NOT NULL,
 updated INTEGER NOT NULL
);
CREATE INDEX nook_notify_queue_due ON nook_notify_queue(state,due);
CREATE INDEX nook_notify_queue_recipient ON nook_notify_queue(user,conversation,state,updated);
CREATE INDEX nook_notify_queue_actor ON nook_notify_queue(actor,state,updated);
CREATE INDEX nook_notify_queue_token ON nook_notify_queue(token_hash);
