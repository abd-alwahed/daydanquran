-- A reader's personal reminder. Sent by the bot in the reader's private chat, which is their one
-- primary channel for now (web push comes with accounts). At most one reminder per reader.
CREATE TABLE reminders (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  city TEXT NOT NULL,                -- an id from CITIES in @daydan/core (clock + prayer times)
  time TEXT NOT NULL,                -- "fixed:450" (minutes after local midnight) or "prayer:asr"
  evening_nudge INTEGER NOT NULL DEFAULT 1,
  ramadan_message INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  since TEXT NOT NULL,               -- local date the reminder was set up or last changed
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every reminder sent: at most one of each kind per reader per local date, so a re-run never resends.
CREATE TABLE reminder_sends (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('daily', 'weekly', 'evening', 'ramadan')),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, local_date, kind)
);
