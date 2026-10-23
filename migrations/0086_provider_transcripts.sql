-- Additive upgrade: provider-generated clip transcripts, off by default. The owner's settings, the sealed provider key and the
-- daily call counter live in their own tables; a provider revision is a new transcript revision labelled by its source.
-- Every existing transcript revision stays human.
CREATE TABLE nook_transcript_settings(
 id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 base_url TEXT NOT NULL,model TEXT NOT NULL,daily_cap INTEGER NOT NULL CHECK(daily_cap BETWEEN 1 AND 1000),version INTEGER NOT NULL
);
CREATE TABLE nook_transcript_secrets(id INTEGER PRIMARY KEY CHECK(id=1),sealed TEXT NOT NULL);
CREATE TABLE nook_transcript_calls(day TEXT PRIMARY KEY,calls INTEGER NOT NULL);
ALTER TABLE nook_clip_transcripts ADD COLUMN source TEXT NOT NULL DEFAULT 'human' CHECK(source IN ('human','provider'));
