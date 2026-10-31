# Rafiq in the offer slot

## What

Rafiq joined Masareef in the offer slot with the same card, a 96 px icon and copy in all
five languages. The slot's seed now includes the placement and platform, so both apps
show, split by platform.

## Mistakes

- Adding Rafiq at weight 1 alone would have looked done and shown nothing: the seed came
  from `useId`, which never changes, so one of two equal offers never appeared. A comment
  on the benched pCloud offer said so.
- The first Rafiq sentence ran 20 characters past Masareef's in a card with a reserved
  height. Own-app copy is measured against that box.
- `sed` could not carry the regex for the comment cleanup and the edit half applied. Node
  scripts go through Write.

## What worked

- A test over real offers and platforms that fails unless both apps are picked.
- Moving `translated` to a table keyed by offer id, so a third app is one entry.

## Rules

- A new live offer needs the coverage test in `promo.test.ts` to still pick it.
- The owner is Pro and cannot see the slot. Check it in a clean Chrome profile.
