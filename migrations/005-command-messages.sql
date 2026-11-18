CREATE TABLE agent_messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  from_agent TEXT NOT NULL REFERENCES agents(id),
  to_agent TEXT NOT NULL REFERENCES agents(id),
  kind TEXT NOT NULL CHECK(kind IN ('command','report')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX agent_messages_recent ON agent_messages(created_at DESC);
CREATE INDEX command_parent ON tasks(json_extract(config,'$.parentTask'));
