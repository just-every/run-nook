-- Body-free projection identity survives deletion of the message's body and
-- retry payload, so both the channel and thread retain the same tombstone.
CREATE TABLE nook_thread_broadcasts(message TEXT PRIMARY KEY);
CREATE TRIGGER nook_thread_broadcast_capture AFTER INSERT ON nook_messages
WHEN json_valid(NEW.payload) AND json_extract(NEW.payload,'$.channelBroadcast')=1
BEGIN INSERT INTO nook_thread_broadcasts VALUES(NEW.id); END;
