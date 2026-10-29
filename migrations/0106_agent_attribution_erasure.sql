-- Native shared-note authorship becomes anonymous when its person is erased.
CREATE TRIGGER nook_agent_sponsor_erased AFTER DELETE ON nook_actors BEGIN
 UPDATE nook_agent_activity SET sponsor_name='Former member' WHERE sponsor=OLD.id;
END;
