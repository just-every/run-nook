-- Native publication, audience review and expiry bindings for the shared door.
CREATE TABLE nook_door_imports (
 plan_id TEXT PRIMARY KEY REFERENCES ik_door_plans(id) ON DELETE CASCADE, domain_job TEXT NOT NULL,
 owner TEXT NOT NULL, source_type TEXT NOT NULL, namespace TEXT NOT NULL,
 capture_digest TEXT NOT NULL, archive_digest TEXT NOT NULL,
 created INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 authority_json TEXT NOT NULL, summary_json TEXT NOT NULL, upload_id TEXT NOT NULL
);
CREATE INDEX nook_door_import_job ON nook_door_imports(domain_job);
