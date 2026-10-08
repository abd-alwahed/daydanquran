-- A reader. Identities from each platform point here, so a future web account can merge with Telegram.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  -- The personal khatma in progress: 1, then 2 after all 604 pages are read, ...
  current_khatma INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE identities (
  provider TEXT NOT NULL,          -- 'telegram' (later 'web')
  provider_user_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, provider_user_id)
);

-- The day's reading: at most one row per reader per local date, whatever the platform.
CREATE TABLE reading_log (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  page INTEGER NOT NULL CHECK (page BETWEEN 1 AND 604),
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, local_date)
);

-- Pages read in each personal khatma, including pages caught up from earlier days.
CREATE TABLE pages_read (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  khatma INTEGER NOT NULL,
  page INTEGER NOT NULL CHECK (page BETWEEN 1 AND 604),
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, khatma, page)
);
