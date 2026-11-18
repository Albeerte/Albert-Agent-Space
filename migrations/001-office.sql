CREATE TABLE rooms (
  id TEXT PRIMARY KEY, space TEXT NOT NULL CHECK (space IN ('it','ai','private')),
  name TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
);
CREATE TABLE profiles (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, provider TEXT NOT NULL,
  model TEXT NOT NULL, base TEXT NOT NULL DEFAULT '', secret TEXT,
  remote_agent TEXT NOT NULL DEFAULT '', tested TEXT, error TEXT
);
CREATE TABLE agents (
  id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), name TEXT NOT NULL,
  role TEXT NOT NULL, lead_id TEXT REFERENCES agents(id),
  profile_id TEXT REFERENCES profiles(id), backup_id TEXT REFERENCES profiles(id),
  allow_paid INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, space TEXT NOT NULL CHECK (space IN ('it','ai')), title TEXT NOT NULL,
  description TEXT NOT NULL, status TEXT NOT NULL, agent_id TEXT REFERENCES agents(id),
  demo INTEGER NOT NULL DEFAULT 0, config TEXT NOT NULL DEFAULT '{}', result TEXT NOT NULL DEFAULT '{}',
  external_id TEXT UNIQUE, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES tasks(id),
  message TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE approvals (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id), fingerprint TEXT NOT NULL,
  action TEXT NOT NULL, status TEXT NOT NULL, decided_at TEXT, error TEXT
);
CREATE TABLE private_items (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('note','plan','document')),
  name TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE private_chats (
  id TEXT PRIMARY KEY, item_id TEXT REFERENCES private_items(id), question TEXT NOT NULL,
  answer TEXT NOT NULL, model TEXT NOT NULL, demo INTEGER NOT NULL,
  external INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX events_task ON events(task_id, seq);
CREATE INDEX tasks_updated ON tasks(updated_at DESC);
