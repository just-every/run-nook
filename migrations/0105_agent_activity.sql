-- Native attribution survives address changes. No credential or private note text.
CREATE TABLE nook_agent_activity (
 operation TEXT NOT NULL, agent TEXT NOT NULL, agent_name TEXT NOT NULL,
 sponsor TEXT NOT NULL, sponsor_name TEXT NOT NULL, approvers TEXT NOT NULL,
 resource TEXT NOT NULL, version INTEGER NOT NULL, at TEXT NOT NULL,
 PRIMARY KEY(operation,resource)
);
CREATE INDEX nook_agent_activity_resource ON nook_agent_activity(resource,version);
