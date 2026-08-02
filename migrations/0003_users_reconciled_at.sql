-- When we last asked Lemon Squeezy about this user's subscription.
--
-- `?reconcile=1` on /api/auth/refresh is a client-controlled flag, so without a
-- persisted per-user clock a loop of that request is one outbound call per
-- request against our account-wide LEMONSQUEEZY_API_KEY — enough to get it rate
-- limited and take the customer portal down for everyone.
--
-- Separate from ls_updated_at, which carries Lemon Squeezy's own timestamp and
-- is what the webhook replay guard compares against: writing "now" into it to
-- record an attempt would make the next genuine event look stale and be dropped.
--
-- Never appears in a WHERE, so it needs no index (see 0001_accounts.sql).

ALTER TABLE users ADD COLUMN ls_reconciled_at INTEGER;
