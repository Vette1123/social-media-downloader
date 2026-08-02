-- Google profile: display name and avatar URL.
--
-- Neither is ever used in a WHERE, so neither gets an index — see 0001 for why
-- that distinction matters on D1. Both are nullable: the `profile` scope was
-- added after the first accounts existed, so rows created before it have
-- nothing here until their owner signs in again.

ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN picture TEXT;
