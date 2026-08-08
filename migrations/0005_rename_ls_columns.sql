-- Drop the `ls_` prefix. It stood for the first billing provider, which never
-- processed a single payment for this project, and it has outlived two of them.
-- The columns describe a subscription, so they are named for one.
--
-- Deliberately a rename rather than add-copy-drop: SQLite's RENAME COLUMN keeps
-- the UNIQUE index on the subscription id and touches no rows, but it does mean
-- code reading the old names breaks the instant this lands. Applied while there
-- were no subscribers, which is the only time it costs nothing.

ALTER TABLE users RENAME COLUMN ls_subscription_id TO sub_id;
ALTER TABLE users RENAME COLUMN ls_customer_id     TO sub_customer_id;
ALTER TABLE users RENAME COLUMN ls_status          TO sub_status;
ALTER TABLE users RENAME COLUMN ls_variant         TO sub_variant;
ALTER TABLE users RENAME COLUMN ls_renews_at       TO sub_renews_at;
ALTER TABLE users RENAME COLUMN ls_ends_at         TO sub_ends_at;
ALTER TABLE users RENAME COLUMN ls_past_due_since  TO sub_past_due_since;
ALTER TABLE users RENAME COLUMN ls_updated_at      TO sub_updated_at;
ALTER TABLE users RENAME COLUMN ls_reconciled_at   TO sub_reconciled_at;
