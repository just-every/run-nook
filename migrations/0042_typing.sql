-- Advisory, session-bound state. This table is intentionally not portable.
CREATE TABLE nook_typing(
 session TEXT NOT NULL,page TEXT NOT NULL,user TEXT NOT NULL,conversation TEXT NOT NULL,expires INTEGER NOT NULL,
 PRIMARY KEY(session,page)
);
CREATE INDEX nook_typing_conversation ON nook_typing(conversation,expires,user);
CREATE INDEX nook_typing_expiry ON nook_typing(expires);
CREATE TRIGGER nook_typing_session_deleted AFTER DELETE ON oa_sessions BEGIN
 DELETE FROM nook_typing WHERE session=OLD.id;
END;
