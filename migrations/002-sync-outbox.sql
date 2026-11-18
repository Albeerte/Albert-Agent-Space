CREATE TABLE task_sync (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id),
  patch TEXT NOT NULL,
  message TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX tasks_agent_status ON tasks(agent_id, status);
