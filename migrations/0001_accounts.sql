-- Accounts and subscriptions. See
-- docs/superpowers/specs/2026-08-02-accounts-subscriptions-design.md
--
-- Every column used in a WHERE is a primary key, UNIQUE, or indexed: D1 bills
-- rows *scanned*, so an unindexed lookup bills the whole table per request.

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  google_sub          TEXT NOT NULL UNIQUE,
  email               TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  prefs               TEXT,

  ls_subscription_id  TEXT UNIQUE,
  ls_status           TEXT,
  ls_variant          TEXT,
  ls_renews_at        INTEGER,
  ls_ends_at          INTEGER,
  ls_past_due_since   INTEGER,
  ls_updated_at       INTEGER
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
