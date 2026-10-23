CREATE TABLE nook_channel_descriptions(
 conversation TEXT PRIMARY KEY REFERENCES nook_conversations(id),
 description TEXT NOT NULL CHECK(length(description)<=2000)
);
CREATE TRIGGER nook_exit_description_insert AFTER INSERT ON nook_channel_descriptions BEGIN INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_exit_description_update AFTER UPDATE ON nook_channel_descriptions BEGIN INSERT INTO nook_exit_changes VALUES(NEW.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER nook_exit_description_delete AFTER DELETE ON nook_channel_descriptions BEGIN INSERT INTO nook_exit_changes VALUES(OLD.conversation,1) ON CONFLICT(conversation) DO UPDATE SET revision=revision+1; END;
