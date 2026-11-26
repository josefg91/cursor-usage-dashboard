-- Esquema SQLite para Cursor Prompt Cost Dashboard
-- Modo WAL y compresión gzip en payloads largos

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS prompt_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_preview TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  uncached_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  cost_source TEXT NOT NULL DEFAULT 'calculated',
  duration_ms INTEGER,
  source TEXT NOT NULL DEFAULT 'cursor_hook'
);

CREATE TABLE IF NOT EXISTS prompt_payloads (
  event_id TEXT PRIMARY KEY,
  prompt_text_gzip BLOB,
  response_text_gzip BLOB,
  raw_hook_json_gzip BLOB,
  FOREIGN KEY (event_id) REFERENCES prompt_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS model_pricing (
  model_key TEXT PRIMARY KEY,
  input_per_1m REAL NOT NULL,
  cache_read_per_1m REAL NOT NULL,
  cache_write_per_1m REAL NOT NULL,
  output_per_1m REAL NOT NULL,
  updated_at TEXT NOT NULL,
  is_override INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_prompt_events_timestamp ON prompt_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_events_conversation ON prompt_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_prompt_events_model ON prompt_events(model);
