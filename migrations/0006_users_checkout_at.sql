-- When this user last opened a Creem checkout.
--
-- Stamped by /api/billing/checkout immediately before the redirect, so that a
-- purchase attempt exists in our own database even if nothing else about it
-- ever arrives.
--
-- The gap this closes: `sub_id` is written only by a webhook, so a buyer whose
-- very first webhook is lost has no id at all — and `needsReconcile` answered
-- "no id, nothing to repair" for exactly that person. Their only route back was
-- the ?checkout=success return page forcing a repair, so closing the tab during
-- payment meant paying and staying on the free plan permanently. With this
-- column the repair has a reason to go looking for them; see reconcile.ts.
--
-- Deliberately not cleared once a subscription lands. It records that an
-- attempt happened, and reconcile bounds itself on the age of the attempt
-- rather than on its absence.
--
-- Never appears in a WHERE, so it needs no index (see 0001_accounts.sql).

ALTER TABLE users ADD COLUMN sub_checkout_at INTEGER;
