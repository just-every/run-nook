ALTER TABLE nook_conversation_notify ADD COLUMN mobile_level TEXT CHECK(mobile_level IS NULL OR mobile_level IN ('all','mentions','nothing'));
ALTER TABLE nook_conversation_notify ADD COLUMN mobile_threads TEXT CHECK(mobile_threads IS NULL OR mobile_threads IN ('all','followed'));
ALTER TABLE nook_push_devices ADD COLUMN device_class TEXT NOT NULL DEFAULT 'desktop' CHECK(device_class IN ('desktop','mobile'));
ALTER TABLE nook_notify_preferences ADD COLUMN push_initialized INTEGER NOT NULL DEFAULT 1 CHECK(push_initialized IN (0,1));
-- Old archives missing this column also retain their deliberate choices.
ALTER TABLE nook_notify_preferences ADD COLUMN thread_badge TEXT NOT NULL DEFAULT 'all' CHECK(thread_badge IN ('all','mentions'));
