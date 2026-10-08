-- Claude's inbox: one row per inbound message to claude@jason-edelman.org.
-- Apply with: npx wrangler d1 migrations apply claude-inbox --remote
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT NOT NULL,
  envelope_from TEXT NOT NULL,
  envelope_to TEXT NOT NULL,
  header_from TEXT,
  subject TEXT,
  message_id TEXT,
  raw_size INTEGER NOT NULL,
  truncated INTEGER NOT NULL DEFAULT 0,
  raw BLOB NOT NULL,
  read_at TEXT
);

-- Dedupes retried deliveries; NULL message_ids are never equal in SQLite,
-- so mail without one is still stored.
CREATE UNIQUE INDEX messages_message_id ON messages (message_id);
CREATE INDEX messages_unread ON messages (id) WHERE read_at IS NULL;
