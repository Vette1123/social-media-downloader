# Paid sponsor card that ends itself (Proxy-Seller, 2026-11-13)

## What
Proxy-Seller paid $100 (GitHub Sponsors, one-time) for one month: one of the two
download cards plus a README mention. The card carries `until` in
`src/config/offers.ts`, checked in the visitor's browser by `selectOffers`, so it
stops at 2026-12-13 12:00 UTC with no deploy. The README mention sits between
dated markers that `scripts/expire-sponsors.mjs` deletes, run daily by
`.github/workflows/expire-sponsors.yml`.

## Mistakes
- First plan was to wait for their tracking link before going live, which would
  have started the month on an unknown day. The owner wanted "30 days from now";
  the SMD15 code attributes sales anyway, so it shipped with the plain domain and
  the link is a one-line href swap that leaves `until` alone.
- Nearly put the long sponsor copy in the `in-content` slot too. Its reserved
  min-height was measured for the apps' short copy, so the long text would have
  shifted the FAQ below it. Sponsor cards are `post-result` only, and the
  agreement was "every download" anyway.
- PRODUCT.md said "no ads" — false the moment a paid card ships. Reworded to
  what is true: no ad networks or scripts, one labelled paid card with an end date.

## What worked
- An end date as data, enforced at render time, not a calendar reminder or a
  later commit: nothing has to happen for it to stop.
- A catalogue test that fails if any live paid offer has no `until`.

## Rules
- Every paid placement gets `until`; every paid README line gets dated markers.
- Sponsor copy goes in `post-result` only unless the in-content height is re-measured.
