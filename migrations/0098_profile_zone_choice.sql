-- Existing stored zones remain explicit choices. New partial writes set this fact.
ALTER TABLE nook_profiles ADD COLUMN zone_chosen INTEGER NOT NULL DEFAULT 1 CHECK(zone_chosen IN (0,1));
