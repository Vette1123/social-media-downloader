-- Who supports the project, keyed by the address they paid with.
--
-- Separate from `users` on purpose, and the separation is the whole point of
-- the table. Support arrives at Buy Me a Coffee, which knows an email address
-- and nothing else; an account here is created by Google sign-in, which may
-- happen days later, never, or under a different address. Writing the grant
-- straight onto `users` — the hand-run `UPDATE users SET grants = 'pro' WHERE
-- email = ?` this replaces — matches zero rows in that window and reports
-- success, so the money lands and the supporter gets nothing.
--
-- This row is the durable record. `users.grants` stays the only thing the app
-- reads, so no request path pays for a second lookup, and it is refreshed from
-- here at two moments: when the webhook lands (if the account already exists)
-- and when the account is created or signs in (src/lib/auth/routes.ts).
--
--   email       Lower-cased. The payer's address as the provider reported it,
--               which is NOT guaranteed to be the address they sign in with.
--   grants      Comma-separated set, written into `users.grants` verbatim.
--   level       The membership level name as it arrived, for the audit trail
--               and for telling a $5/month from a one-time Lifetime later.
--   lifetime    1 = a cancellation event may never revoke this. A one-time
--               purchase has nothing to cancel, but the provider still emits
--               `membership.cancelled` when the member removes the level from
--               their account, and honouring that would take back something
--               already paid for in full.
--   source      Which provider sent it. One column now, because the second
--               provider is exactly what this table was built during.
--   event_id    The last event applied, so an immediate redelivery is a no-op.
--   updated_at  Epoch millis of the event, not of the write. Compared against
--               the next event's own stamp so an out-of-order delivery cannot
--               reinstate a cancelled membership.
--
-- Looked up by primary key only, so it needs no index.

CREATE TABLE IF NOT EXISTS supporters (
  email      TEXT PRIMARY KEY,
  grants     TEXT NOT NULL,
  level      TEXT,
  lifetime   INTEGER NOT NULL DEFAULT 0,
  source     TEXT NOT NULL DEFAULT 'bmc',
  event_id   INTEGER,
  updated_at INTEGER NOT NULL
);
