# Withdrawing the subscription, and replacing it with hand-set grants

## What

Creem rejected the payout account a second time, after every fixable item on
their published checklist had been fixed and an email had been sent. Two
merchants of record have now refused: Lemon Squeezy silently on 2026-08-08,
Creem twice. The second rejection is the informative one — with the checklist
failures gone, what is left is the product category.

So the subscription was withdrawn rather than reworded a third time:

- `/pro` is a donation page pointing at Buy Me a Coffee. No checkout, no plan
  picker, no price anywhere in the built export.
- `/api/billing/checkout` is a 302 to `/pro`. The route stays because old links,
  open tabs and installed PWA shells still point at it.
- The four features stayed and are granted by hand: a new `users.grants` column
  holds a comma-separated set, set with one `wrangler d1 execute`, effective
  within one 15-minute token TTL with no deploy.
- A second grant, `ig`, attaches the operator's own `IG_SESSIONID` to that
  account's Instagram resolves.

The webhook, portal, reconcile and `isProAt` code is untouched and still tested,
so a fork that finds a willing processor has a working half to build on.

## Mistakes

- **The first instinct was to make the four features free, and it was wrong for
  a reason that only showed up two steps in.** Flipping `useTier()` to always
  return `'pro'` is a one-line change that unlocks the queue and ZIP — and also
  suppresses the sponsor card for every visitor, because `PromoSlot` hides
  itself for Pro. That card is now one of exactly two things paying for the
  site. The one-line version would have deleted the revenue as a side effect of
  granting the features. Caught only by reading `PromoSlot`'s tier check rather
  than trusting the name of the hook.
- **Half an hour of edits had to be reverted.** `useTier` was deleted, its
  `ensureFreshToken()` effect rehomed, and `PromoSlot` rewritten — before it
  became clear the tier machinery should stay exactly as it is and only the
  *source* of `pro` should change. The rule that would have avoided it: when the
  question is "who gets this", change what feeds the decision, never the decision
  points. There were seven call sites and one input.
- **`useTier` turned out to be the only caller of `ensureFreshToken`.** Deleting
  the hook silently stopped every access-token refresh, and nothing failed —
  there are no subscribers, so no test and no screen would have noticed until a
  grant was set and mysteriously stopped working after 15 minutes. Grep for
  callers of anything a deleted hook calls, not just callers of the hook.
- **`isProAt` was nearly the place to put the grant.** It is documented as "the
  only place in the codebase that decides", which reads like an invitation. But
  `mayApply` in the webhook depends on it meaning *what does this subscription
  entitle* — folding a grant in would have let a hand-set flag block a legitimate
  superseding webhook event. Split into `isEntitled` instead, and `isProAt` was
  left alone. A function's docstring describes what it did, not what it should
  absorb next.
- **The credentialed resolve would have poisoned the shared edge cache.** The
  first design gave it a cache key component. That fixes the collision and still
  writes login-gated payloads into a store that is colo-wide and addressable by
  any anonymous visitor who can construct the key — the exact shape of the old
  `auth`/`anon` split that was removed for being unsafe. Correct answer was to
  bypass both tiers in both directions; there is one such account, so the cost is
  one uncached resolve.
- **`hasGrant` was first written as `grants.includes(name)`.** `'igloo'`
  contains `'ig'`, and `ig` is the flag that attaches our session cookie to a
  request. Split on commas and compare exactly. There is a test for `igloo`
  specifically.
- **The migration tracker was already out of sync and `migrations apply` would
  have failed.** `0006` showed as pending while `sub_checkout_at` existed on the
  table — it had been applied by hand at some point. Running the batch would have
  hit `duplicate column name` on `0006` and never reached `0007`. Checked
  `pragma_table_info` first and applied the single `ALTER` the same way. Worth
  knowing that this database's migration history is bookkeeping, not truth.
- **Deleting `seller` and `merchantOfRecord` from `siteConfig` broke six files
  at once**, which is the useful signal: the merchant-of-record sentence had
  spread to the footer, /terms, /privacy and /pro. Removing the constant found
  every one of them, where grepping the prose would have missed at least the
  footer.
- **The README was false again, in the same way as last time.** "A Google
  sign-in exists for Pro subscribers only", a `Billing | Creem` row in the tech
  stack table, and a whole Creem setup section. The last lesson's rule about the
  README being one click from the footer had to be applied a second time, which
  means it was learned as a fact rather than as a habit.
- **`pnpm build` does not produce `out/`.** Grepping the built export for stale
  price strings found `Get Pro, $3/mo` still present — from a build twelve hours
  old. The Cloudflare artifact comes from `pnpm cf:build`, which is what the
  deploy runs. A stale `out/` looks exactly like a real failure.

## What worked

- **Reading `PromoSlot` before trusting `useTier`'s name.** The single highest-value
  five minutes of the whole change.
- **Two grants instead of one boolean, decided before any code was written.**
  `pro` is offered and `ig` is not, and because they are separate names,
  `isEntitled` can be written so that no supporter can ever reach the credential
  path. One flag with a comment saying "don't sell this" would have been one
  refactor away from being sold.
- **Testing the credential gate on the shipped private getter** rather than on a
  re-implementation, via a cast — `private` is compile-time only, and this is the
  line that decides whether a cookie leaves the Worker. Includes cases for
  `'true'`, `1` and `{}`, since the value originates in a JSON token claim.
- **Inverting the price test instead of deleting it.** `prices only the states
  that are actually charging` became `never prices anything, because nothing is
  charging`. The failure it guards against changed direction; it did not go away.
- **Checking `pragma_table_info` before every schema step**, both before applying
  and after.
- **Ordering the deploy around the exposure rather than around convenience** —
  see the rules below.

## Rules

- When the question is "who gets this feature", change the input to the
  decision, never the decision points. Seven call sites, one hook, one source.
- Before deleting a hook, grep for callers of everything it calls. A deleted
  effect fails silently and much later.
- A capability that must never be sold gets its own name, not a flag inside one
  that is. Names are what make the "cannot reach" testable.
- Never key a cache on a credential. Bypass it. A shared store that is correct
  per-key is still a store holding credentialed payloads.
- Set membership is `split(',').some(exact)`, never `includes()`. Substrings are
  how a capability check starts saying yes.
- `IG_SESSIONID` goes up **after** the code that gates it, never before. The
  live Worker attaches it deployment-wide, so uploading the secret first opens a
  window where every visitor's Instagram resolve carries it — the exact exposure
  the change removes. Apply schema → deploy code → upload secret → set the grant.
- Schema still goes ahead of code, and this database's migration tracker is not
  to be trusted: check `pragma_table_info` rather than `migrations list`.
- Grep `out/` after running `pnpm cf:build`, not `pnpm build`. The latter does
  not write it, and a twelve-hour-old export reads as a live failure.
- Deleting a shared constant is a better find-and-replace than grepping prose:
  the compiler lists every page that made the claim.
