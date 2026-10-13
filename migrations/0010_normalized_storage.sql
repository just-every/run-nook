-- Append-only authority transition. Existing installations stay paused until the
-- explicit offline converter validates and atomically cuts over.
CREATE TABLE nook_storage(id INTEGER PRIMARY KEY CHECK(id=1),authority TEXT NOT NULL CHECK(authority IN ('legacy','normalized')),phase TEXT NOT NULL);
INSERT INTO nook_storage SELECT 1,CASE WHEN EXISTS(SELECT 1 FROM workspace) THEN 'legacy' ELSE 'normalized' END,'ready';
CREATE TABLE nook_guard(id TEXT PRIMARY KEY,ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE nook_actors(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT,role TEXT,active INTEGER NOT NULL CHECK(active IN (0,1)));
CREATE TABLE nook_conversations(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('channel','private','dm')),owner TEXT NOT NULL,seq INTEGER NOT NULL DEFAULT 0 CHECK(seq>=0),version INTEGER NOT NULL DEFAULT 1,message_count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE nook_members(conversation TEXT NOT NULL REFERENCES nook_conversations(id),user TEXT NOT NULL,PRIMARY KEY(conversation,user));
CREATE INDEX nook_member_directory ON nook_members(user,conversation);
CREATE TABLE nook_messages(id TEXT PRIMARY KEY,conversation TEXT NOT NULL REFERENCES nook_conversations(id),author TEXT NOT NULL,body TEXT NOT NULL,body_lower TEXT NOT NULL,parent TEXT,version INTEGER NOT NULL,deleted INTEGER NOT NULL CHECK(deleted IN (0,1)),created TEXT NOT NULL,intent TEXT NOT NULL,payload TEXT NOT NULL,sequence INTEGER NOT NULL,ordinal INTEGER NOT NULL,author_ordinal INTEGER NOT NULL,UNIQUE(conversation,author,intent),UNIQUE(conversation,sequence));
CREATE INDEX nook_history_cursor ON nook_messages(conversation,(created||id));
CREATE INDEX nook_message_author ON nook_messages(conversation,author,sequence);
CREATE INDEX nook_thread_history ON nook_messages(conversation,parent,sequence);
CREATE INDEX nook_unread_author ON nook_messages(conversation,author,sequence) WHERE deleted=0;
CREATE TABLE nook_revisions(message TEXT NOT NULL REFERENCES nook_messages(id),version INTEGER NOT NULL,body TEXT NOT NULL,at TEXT NOT NULL,PRIMARY KEY(message,version));
CREATE TABLE nook_events(conversation TEXT NOT NULL REFERENCES nook_conversations(id),seq INTEGER NOT NULL,kind TEXT NOT NULL,object TEXT NOT NULL,actor TEXT,PRIMARY KEY(conversation,seq));
CREATE TABLE nook_outcomes(id TEXT PRIMARY KEY,conversation TEXT NOT NULL REFERENCES nook_conversations(id),author TEXT NOT NULL,assignee TEXT,kind TEXT NOT NULL,body TEXT NOT NULL,source TEXT,source_version INTEGER,version INTEGER NOT NULL,status TEXT NOT NULL,deadline TEXT);
CREATE INDEX nook_outcome_scope ON nook_outcomes(conversation,id);
CREATE INDEX nook_outcome_source ON nook_outcomes(source);
CREATE TABLE nook_outcome_versions(outcome TEXT NOT NULL REFERENCES nook_outcomes(id),version INTEGER NOT NULL,actor TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,deadline TEXT,PRIMARY KEY(outcome,version));
CREATE TABLE nook_reads(conversation TEXT NOT NULL,user TEXT NOT NULL,seq INTEGER NOT NULL,total INTEGER NOT NULL DEFAULT 0,own INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(conversation,user));
CREATE TABLE nook_preferences(user TEXT NOT NULL,conversation TEXT NOT NULL,muted INTEGER NOT NULL DEFAULT 0,followed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user,conversation));
CREATE TABLE nook_thread_follows(user TEXT NOT NULL,message TEXT NOT NULL,PRIMARY KEY(user,message));
CREATE TABLE nook_settings(user TEXT PRIMARY KEY,dnd_until INTEGER);
CREATE TABLE nook_attention(id TEXT PRIMARY KEY,user TEXT NOT NULL,conversation TEXT NOT NULL,event_seq INTEGER NOT NULL,message TEXT,outcome TEXT,reason TEXT NOT NULL,state TEXT NOT NULL,snooze_until INTEGER,created TEXT NOT NULL,UNIQUE(user,conversation,event_seq));
CREATE INDEX nook_attention_inbox ON nook_attention(user,conversation,state,id);
CREATE INDEX nook_attention_deadline ON nook_attention(user,conversation,state,snooze_until);
CREATE TABLE nook_attachments(id TEXT PRIMARY KEY,conversation TEXT NOT NULL,author TEXT NOT NULL,message TEXT,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT,expires INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('reserved','staged','attached','deleted')),created TEXT NOT NULL,object_key TEXT UNIQUE,intent TEXT NOT NULL,position INTEGER,UNIQUE(author,intent));
CREATE INDEX nook_attachment_message ON nook_attachments(message,position);
CREATE INDEX nook_attachment_staged ON nook_attachments(author,state,expires);
CREATE TABLE nook_object_deletes(object_key TEXT PRIMARY KEY,created INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
-- FTS5 trigram indexes exact substrings of length >=3. Short queries are
-- rejected explicitly rather than silently degenerating to a table scan.
CREATE VIRTUAL TABLE nook_search USING fts5(message UNINDEXED,conversation UNINDEXED,source,scope,body_lower,tokenize='trigram case_sensitive 1');
CREATE TABLE nook_imports(id TEXT PRIMARY KEY,owner TEXT NOT NULL,intent TEXT NOT NULL,plan_digest TEXT NOT NULL,capture_digest TEXT NOT NULL,created TEXT NOT NULL,namespace TEXT NOT NULL,preview_digest TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('staging','complete')),UNIQUE(owner,intent));
CREATE TABLE nook_import_channels(job TEXT NOT NULL,source_id TEXT NOT NULL,conversation TEXT NOT NULL UNIQUE,source_record TEXT NOT NULL,PRIMARY KEY(job,source_id));
CREATE TABLE nook_import_actors(job TEXT NOT NULL,source_id TEXT NOT NULL,association TEXT,source_record TEXT NOT NULL,PRIMARY KEY(job,source_id));
CREATE TABLE nook_import_records(id TEXT PRIMARY KEY,job TEXT NOT NULL,key TEXT NOT NULL UNIQUE,conversation TEXT NOT NULL,source_actor TEXT NOT NULL,source_timestamp TEXT NOT NULL,source_record TEXT NOT NULL,body TEXT NOT NULL,body_lower TEXT NOT NULL,parent TEXT,sequence INTEGER NOT NULL,UNIQUE(conversation,sequence));
CREATE TABLE nook_import_files(id TEXT PRIMARY KEY,job TEXT NOT NULL,message TEXT NOT NULL,source_id TEXT NOT NULL,attachment TEXT NOT NULL,position INTEGER NOT NULL);
CREATE INDEX nook_import_file_message ON nook_import_files(message,position);
CREATE TABLE nook_import_receipts(job TEXT NOT NULL,path TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(job,path,sha256));
CREATE TABLE nook_conversion(id INTEGER PRIMARY KEY CHECK(id=1),source_revision INTEGER NOT NULL,source_digest TEXT NOT NULL,phase TEXT NOT NULL,counts TEXT NOT NULL);
INSERT INTO schema_migrations VALUES(5,'normalized-storage-v5');

CREATE TABLE nook_author_counts(conversation TEXT NOT NULL,user TEXT NOT NULL,total INTEGER NOT NULL,PRIMARY KEY(conversation,user));
INSERT INTO nook_actors SELECT id,display_name,email,role,CASE WHEN status='active' THEN 1 ELSE 0 END FROM oa_operators;
CREATE TRIGGER nook_actor_created AFTER INSERT ON oa_operators BEGIN
 INSERT INTO nook_actors VALUES(NEW.id,NEW.display_name,NEW.email,NEW.role,CASE WHEN NEW.status='active' THEN 1 ELSE 0 END)
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,role=excluded.role,active=excluded.active;
END;
CREATE TRIGGER nook_actor_updated AFTER UPDATE OF display_name,email,role,status ON oa_operators BEGIN
 UPDATE nook_actors SET name=NEW.display_name,email=NEW.email,role=NEW.role,active= CASE WHEN NEW.status='active' THEN 1 ELSE 0 END WHERE id=NEW.id;
END;
-- Every in-flight put is durable. Deletion cannot race a late writer. Interrupted
-- attempts are reconciled only by the explicit paused operator command.
CREATE TABLE nook_upload_attempts(id TEXT PRIMARY KEY,object_key TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX nook_upload_attempt_object ON nook_upload_attempts(object_key);
