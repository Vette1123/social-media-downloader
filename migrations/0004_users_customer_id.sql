-- Creem's customer id for this user.
--
-- The billing portal is generated per customer, not per subscription
-- (POST /v1/customers/billing takes a customer_id), so without this column
-- every "Manage billing" click would first have to fetch the subscription just
-- to learn who owns it — two upstream calls for one redirect.
--
-- It is also what reconcile hands to the subscription search when a user's
-- very first webhook was lost: that user has no subscription id yet by
-- definition, so the customer looked up by email is the only thread back to
-- what they bought.
--
-- Written by the webhook and by reconcile, both keyed on users.id. Nullable
-- because every row predating a purchase has no customer, and because a
-- subscription event that arrives with `customer` unexpanded carries no id to
-- store.
--
-- Never appears in a WHERE, so it needs no index (see 0001_accounts.sql).

ALTER TABLE users ADD COLUMN ls_customer_id TEXT;
