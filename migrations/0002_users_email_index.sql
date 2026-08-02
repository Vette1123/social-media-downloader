-- The webhook's fallback lookup matches on email when a checkout arrives
-- without custom_data.user_id (src/lib/billing/webhook.ts). Without this index
-- that path scans the whole users table, and D1 bills rows *scanned* — the
-- invariant 0001_accounts.sql states but this column missed.
--
-- Not UNIQUE: Google is the identity, so two accounts sharing an address is a
-- state the schema should tolerate rather than reject at write time.

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
