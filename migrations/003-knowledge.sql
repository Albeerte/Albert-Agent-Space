CREATE TABLE memories (
  id TEXT PRIMARY KEY, space TEXT NOT NULL CHECK(space IN ('it','ai','private')),
  title TEXT NOT NULL, body TEXT NOT NULL,
  source_task TEXT REFERENCES tasks(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE memory_versions (
  memory_id TEXT NOT NULL REFERENCES memories(id), version INTEGER NOT NULL,
  body TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(memory_id,version)
);
CREATE TABLE skills (
  id TEXT PRIMARY KEY, space TEXT NOT NULL CHECK(space IN ('it','ai','private')),
  name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE skill_versions (
  skill_id TEXT NOT NULL REFERENCES skills(id), version INTEGER NOT NULL,
  body TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
  PRIMARY KEY(skill_id,version)
);
CREATE TABLE agent_skills (
  agent_id TEXT NOT NULL REFERENCES agents(id), skill_id TEXT NOT NULL REFERENCES skills(id),
  PRIMARY KEY(agent_id,skill_id)
);
CREATE TABLE improvements (
  id TEXT PRIMARY KEY, space TEXT NOT NULL CHECK(space IN ('it','ai','private')),
  kind TEXT NOT NULL CHECK(kind IN ('memory','skill')), title TEXT NOT NULL, body TEXT NOT NULL,
  evidence TEXT NOT NULL, task_id TEXT REFERENCES tasks(id), revision_key TEXT NOT NULL,
  skill_id TEXT REFERENCES skills(id), base_version INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
  demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, decided_at TEXT,
  applied_id TEXT, UNIQUE(task_id,kind,revision_key)
);
CREATE INDEX memories_space ON memories(space,updated_at DESC);
CREATE INDEX skills_space ON skills(space,updated_at DESC);
CREATE INDEX improvements_space ON improvements(space,status,created_at DESC);
