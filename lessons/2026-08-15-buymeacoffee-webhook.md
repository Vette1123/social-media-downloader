# The membership that could not be delivered to an account that does not exist

## What

Two Buy Me a Coffee membership levels went live — a $5/month Supporter and a $35
one-time Lifetime — and the grant behind them was automated. New:

- `src/lib/billing/bmc.ts` — the webhook, written to be copied into another
  project. Offer names and what they grant are configuration.
- `src/config/support.ts` — `SUPPORT_TAG` and the two offer names derived from
  it. One const decides what the webhook matches and what the support page
  prints, so the dashboard, the handler and the page cannot drift apart.
- `src/lib/billing/hmacWebhook.ts` — the signature check, the bounded read and
  the size cap, extracted from the Creem handler because the second provider
  wanted all three unchanged.
- `migrations/0008_supporters.sql` — support recorded against an email address,
  independent of whether an account exists.
- `claimSupporterGrants`, called on every sign-in.
- `withGrant` / `withoutGrant` in `entitlement.ts`.
- `docs/buymeacoffee-setup.md` — every field of the two levels, the recovery
  flow, the wiring steps, and what to copy into the next project.

## Mistakes

- **Shipped a membership that unlocked every project at once.** The first copy
  promised "supporter status across everything I build", and the handler backed
  it: `fallback` defaulted to granting `pro`, so *any* membership event on the
  Buy Me a Coffee account — including one bought for a different project —
  granted here. One $5 membership would have covered every site on the account,
  forever, by design. The fix is that the name of the thing bought is the only
  thing tying support to a project (`Downloader — Supporter`,
  `Downloader — Lifetime`, from `SUPPORT_TAG`), and `fallback` now defaults to
  `null`. Worth naming because the defaulting argument was *right in isolation*:
  an unattributable event is someone who paid, and dropping it means an angry
  email. It stops being right the moment the account is shared, and the account
  was always going to be shared.
- **Reached for a shared database before checking the accounts.** The first
  answer to "which project is this membership for" was one D1 holding
  supporters, bound to every project's Worker. It died on a fact nobody had
  written down: each project lives in its own Cloudflare account, so there is no
  binding to share. An hour of design against an assumption about infrastructure
  that one question would have settled.
- **Two cards per project, and nobody noticed until it was drawn.** Tagged
  levels meant a Supporter *and* a Lifetime level per project on one page — six
  cards at three projects, and the memberships list is the first thing a
  supporter sees. Fixed by putting the one-time Lifetime on the Extras shelf
  where one-time purchases belong, which halves the membership list and makes
  `extra_purchase.created` safe to enable, because the tag still has to match.
  The count only became obvious when the page was described out loud rather than
  reasoned about a level at a time.
- **The revoke path had the same hole, one layer down.** Even with per-project
  levels, a `membership.cancelled` for another project's level would have
  deleted this project's `supporters` row and pulled `pro` — cancelling
  somewhere else revokes here. Cancellations are now matched against the level
  too. An unnamed cancellation is still acted on, deliberately: refusing every
  one of those is how a membership becomes permanent.
- **Priced the lifetime below the yearly.** $35 once against $50 a year. It
  does not merely undercut the annual tier, it deletes it — nobody rational
  buys twelve months for $50 when forever costs $35 — and it pays back in seven
  months, so the best supporters are the ones it costs the most. Corrected to
  $99, two years of the yearly. The rule that was missing: a lifetime is a
  *multiple* of the annual, never a discount on it. Also worth naming: an
  underpriced lifetime is unrecoverable, because everyone who bought keeps it,
  while an overpriced one just does not sell. When one direction is free and
  the other is one-way, start on the free side.
- **Wrote the whole setup document around a shelf the product never went on.**
  The Lifetime was specified as an Extra, with a section explaining why that
  kept the membership list short. It was then created as a one-time membership
  level — which is the more obvious place, and which the first screenshot of
  the live page revealed. No code broke (a one-time level still fires
  `membership.started`), but a page of reasoning had to be rewritten. Documenting
  a provider's UI from its API is guessing.
- **Copy that only rendered correctly in the editor.** The descriptions ended
  with a paragraph after a bullet list, and the provider collapses that blank
  line — so the closing sentence arrived glued to the last bullet on the live
  card. Rewards render title and description concatenated with no separator,
  which turned "Every supporter extra, permanently" plus its description into
  one run-on line. Both were invisible until the page was looked at. Copy for
  someone else's rendering engine is not finished when it reads well in the
  source.
- **Held a rule past the point it was right.** "Never name a feature in the
  dashboard copy" was sound while the copy had to survive a merchant-of-record
  review and stay generic across projects. Applied to a Buy Me a Coffee card it
  produced a description that asked for $5 and never said what for. The user's
  correction was blunt and correct. A constraint inherited from a dead context
  needs re-deriving, not enforcing.
- **Declared it live before anything had been delivered *by the provider*.**
  Every production check passed — signatures, grants, cancellation, row
  lifecycle — because every one of them was a request I signed and sent myself.
  The provider's own first delivery was challenged at the edge by Bot Fight
  Mode and never reached the Worker at all. `wrangler tail` was silent, which
  reads exactly like "nobody has sent anything yet" rather than like a failure.
  Found by querying `firewallEventsAdaptive`, which showed
  `managed_challenge / botFight / /api/billing/bmc` from AWS with the user agent
  `BMC-HTTPS-ROBOT`. This is the second provider it has happened to on this zone
  and it was in the lessons already; I tested the half I controlled and called
  it done.
- **The obvious design was silently broken.** The first shape was the one the
  README already documents: the webhook lands, `UPDATE users SET grants = 'pro'
  WHERE email = ?`. It is wrong for the *most common* path, not an edge case.
  Nothing on the support page asks anyone to sign in first, the `users` row is
  only created by Google OAuth (`routes.ts:262`), and D1 reports a zero-row
  UPDATE as success. Money in, nothing out, no error anywhere. Caught by
  reading the sign-in handler rather than by testing, which is the part worth
  keeping: the bug is invisible in any test where the user already exists.
- **`UPDATE ... SET grants = 'pro'` was going to eat `ig`.** The column is a
  set, and the documented hand-run command assigns the whole thing. Writing the
  webhook the same way would have detached the Instagram session from any
  account holding both, with nothing to report it. The README command still has
  this hazard; it is now called out there rather than fixed, because the
  webhook is the path that matters.
- **Lifetime was nearly revocable.** `membership.cancelled` fires when a member
  removes a level from their account — including a one-time level with nothing
  left to cancel. Without `supporters.lifetime` the handler would have taken
  back something paid for in full, months later, silently.
- **Priced the Lifetime level at $500 in the dashboard first.** Ten years of the
  yearly. Copy is not the only thing worth reviewing before Create.
- **Guessed at `data` and had to stop.** The envelope is documented; the field
  names inside it are only in an OpenAPI file behind the dashboard login. The
  first draft named `supporter_email` outright. Replaced with a candidate-key
  search plus a log line naming the keys that *did* arrive, because a guess
  that is wrong here drops every supporter and looks like a working endpoint.
  The same uncertainty is why `extra_purchase.created` is not in the default
  grant set: it also fires for shop items.

## What worked

- **Reading the whole flow before choosing the table.** The `supporters` table
  is more than a `pending_grants` stopgap and less than a rewrite, and that only
  became obvious after tracing sign-in, entitlement and the existing webhook end
  to end. Cancel-after-lifetime, redelivery and paid-under-another-address all
  fall out of the same row.
- **The second provider paid for the extraction.** `hmacWebhook.ts` is the
  Creem code unchanged; both handlers now share one constant-time comparison
  instead of two.
- **An in-memory D1 rather than a statement-level mock.** The handler's job is
  the state left across several statements, so the tests assert the supporter
  ends up entitled — not that the right SQL was formatted.
- **Checked the startup budget after adding a module.** 153.5 KiB against the
  200 KiB CI gate.
- **Ran it end to end against workerd and a real D1, not the fake.** 36 checks
  over HTTP against `wrangler dev`: signatures, grants, sibling projects,
  extras, cancellation, replay, malformed bodies. It caught what unit tests
  structurally cannot — the local database was still on the LemonSqueezy-era
  schema with no `grants` column at all, so every `UPDATE users SET grants` in
  the suite had been passing against an in-memory object that was never checked
  against a real table. `wrangler d1 migrations apply --local` first, then test.
- **Drove the one function the HTTP surface cannot reach.** `claimSupporterGrants`
  runs inside the Google OAuth callback, so no request can reach it without a
  live sign-in. A throwaway Worker in the scratch directory imported the real
  function and bound the same local D1 — five more checks, none of them mocked,
  nothing added to the repo.

## Rules

- A webhook that writes to a row keyed by email must answer "what if that row
  does not exist yet" before anything else. In a Google-OAuth product the
  account usually arrives *after* the money.
- A zero-row `UPDATE` is a success in D1. If the write is the whole point of the
  request, check `meta.changes` or record it somewhere that cannot miss.
- Never assign a set-valued column. Add and remove names.
- A one-time purchase still receives cancellation events. Mark it unrevocable at
  the point of purchase, not at the point of cancellation.
- Do not write a handler against guessed field names. Search candidates, log the
  keys you actually saw, and let the first real delivery settle it.
- Provider events are retried and can arrive out of order. Guard on the event id
  *and* on its timestamp; they catch different failures.
- One payment account serving several products means every endpoint sees every
  event. Something in the payload has to say which product it was — here the
  offer name — and anything unrecognised must fail closed, on the grant *and* on
  the revoke.
- With one payment account you can have at most two of: identical generic
  offers, no shared infrastructure, and support belonging to exactly one
  product. Name the trilemma before designing, because every design is a choice
  of which one to drop, and dropping the third silently is the default.
- When the discriminator is a string typed into someone else's dashboard,
  compare it with the punctuation folded out. Six characters render as a dash
  and none of them are distinguishable in an editor.
- A webhook is not verified until the *provider* has delivered one. Requests you
  sign yourself skip the edge, and the edge is where two of these have died.
  Silence in `wrangler tail` is ambiguous: it means "not delivered", never "not
  sent".
- A lifetime price is a multiple of the annual, never a discount on it. Price
  the irreversible side high: unsold is free, underpriced is permanent.
- Copy written for someone else's dashboard is not done until it has been seen
  on the live page. Blank lines collapse, fields concatenate, and none of that
  is visible in the editor.
- A hand-rolled in-memory database proves the logic and nothing about the
  schema. Anything that writes columns needs one run against the real engine
  before it is called done — and the local copy of that database is stale until
  proven otherwise.
- A grant with no expiry is the wrong shape for a one-time payment of an unknown
  amount. `sub_ends_at` with a future date already means "paid through", so a
  one-off coffee is an expiring window rather than a permanent name in `grants`.

Related: `lessons/2026-08-10-withdrawing-the-subscription.md` for why `pro` and
`ig` are separate names, and `docs/buymeacoffee-setup.md` for the copy and the
setup steps.
