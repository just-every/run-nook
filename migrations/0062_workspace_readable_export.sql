-- Whole-workspace readable export is a separate, explicit owner authority.
CREATE TABLE nook_exit_policy(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),version INTEGER NOT NULL DEFAULT 1);
INSERT INTO nook_exit_policy(id) VALUES(1);
ALTER TABLE nook_exit_jobs ADD COLUMN workspace_policy_version INTEGER;
CREATE TRIGGER nook_exit_configuration_nook_default_policy_insert AFTER INSERT ON nook_default_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_default_policy_update AFTER UPDATE ON nook_default_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_default_policy_delete AFTER DELETE ON nook_default_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_default_channels_insert AFTER INSERT ON nook_default_channels BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_default_channels_update AFTER UPDATE ON nook_default_channels BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_default_channels_delete AFTER DELETE ON nook_default_channels BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_broadcast_policy_insert AFTER INSERT ON nook_broadcast_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_broadcast_policy_update AFTER UPDATE ON nook_broadcast_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_broadcast_policy_delete AFTER DELETE ON nook_broadcast_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_broadcast_people_insert AFTER INSERT ON nook_broadcast_people BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_broadcast_people_update AFTER UPDATE ON nook_broadcast_people BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_configuration_nook_broadcast_people_delete AFTER DELETE ON nook_broadcast_people BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
