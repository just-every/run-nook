-- Native message transactions create these choices; importing old history does
-- not backfill follows. Existing follows were all explicit choices.
ALTER TABLE nook_thread_follows ADD COLUMN source TEXT NOT NULL DEFAULT 'explicit'
 CHECK(source IN ('explicit','authored','replied','mentioned','dm'));
CREATE INDEX nook_thread_follow_message ON nook_thread_follows(message,user);
CREATE TABLE nook_thread_unfollows(user TEXT NOT NULL,message TEXT NOT NULL,PRIMARY KEY(user,message));
CREATE INDEX nook_thread_unfollow_message ON nook_thread_unfollows(message,user);
CREATE TABLE nook_thread_reads(user TEXT NOT NULL,message TEXT NOT NULL,seq INTEGER NOT NULL CHECK(seq>=0),PRIMARY KEY(user,message));
CREATE INDEX nook_thread_read_message ON nook_thread_reads(message,user);
CREATE INDEX nook_import_thread_history ON nook_import_records(conversation,parent,sequence);
