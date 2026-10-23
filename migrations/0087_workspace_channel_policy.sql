-- Existing workspaces keep their channel management rules until an owner saves.
CREATE TABLE nook_workspace_channel_policy(
 id INTEGER PRIMARY KEY CHECK(id=1),
 version INTEGER NOT NULL CHECK(version>0),
 create_public TEXT NOT NULL CHECK(create_public IN ('owners','admins','members')),
 create_private TEXT NOT NULL CHECK(create_private IN ('owners','admins','members')),
 archive TEXT NOT NULL CHECK(archive IN ('owners','admins','members'))
);
CREATE TRIGGER nook_exit_workspace_channels_insert AFTER INSERT ON nook_workspace_channel_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_workspace_channels_update AFTER UPDATE ON nook_workspace_channel_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER nook_exit_workspace_channels_delete AFTER DELETE ON nook_workspace_channel_policy BEGIN UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1; END;
