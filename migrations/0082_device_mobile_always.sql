-- Additive upgrade: existing devices keep every row and follow the account's mobile choice.
ALTER TABLE nook_push_devices ADD COLUMN mobile_always INTEGER NOT NULL DEFAULT 0 CHECK(mobile_always IN (0,1));
