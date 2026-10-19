-- NOOK-079 integration tokens. A family keeps one name, creator and set of bound
-- conversations across rotations; each secret is stored only as a sealed hash.
CREATE TABLE nook_integration_tokens(id TEXT PRIMARY KEY,family TEXT NOT NULL,name TEXT NOT NULL,creator TEXT NOT NULL,hash TEXT NOT NULL UNIQUE,created INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('active','rotated','revoked')),ended INTEGER);
CREATE UNIQUE INDEX nook_integration_active_family ON nook_integration_tokens(family) WHERE state='active';
CREATE TABLE nook_integration_bindings(family TEXT NOT NULL,conversation TEXT NOT NULL,PRIMARY KEY(family,conversation));
-- Every management action and every use of a known token, including refusals.
CREATE TABLE nook_integration_audit(id TEXT PRIMARY KEY,family TEXT NOT NULL,token TEXT NOT NULL,name TEXT NOT NULL,at INTEGER NOT NULL,action TEXT NOT NULL CHECK(action IN ('create','rotate','revoke','post','replay','refuse')),actor TEXT,conversation TEXT,message TEXT,code TEXT,route TEXT);
CREATE INDEX nook_integration_audit_family ON nook_integration_audit(family,at);
CREATE INDEX nook_integration_audit_message ON nook_integration_audit(message) WHERE message IS NOT NULL;
CREATE TRIGGER nook_integration_conversation_deleted AFTER DELETE ON nook_conversations BEGIN DELETE FROM nook_integration_bindings WHERE conversation=OLD.id; END;
