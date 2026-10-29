-- Agent-origin notifications retain their admission with the native queue row.
-- Ordinary person notifications have no agent admission. Queue state is excluded
-- from archives, so restoration cannot revive an agent delivery.
ALTER TABLE nook_notify_queue ADD COLUMN agent_context TEXT
 CHECK(agent_context IS NULL OR json_valid(agent_context));
