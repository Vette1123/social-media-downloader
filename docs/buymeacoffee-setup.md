# Buy Me a Coffee: the offers, and how the grant lands

A template. Everything below works for any project on the account — fill the
one table in the next section, paste the blocks, and nothing else changes.

## How support is tied to one project

One Buy Me a Coffee account serves every project. Every webhook endpoint on that
account receives **every** event, because endpoints subscribe to event *types*,
not to offers. So the project has to be written into the only per-purchase
attribute the provider carries and we control: **the name of the thing bought**.

Each project therefore tags its two offers with its own short name, and its
endpoint recognises those two names and nothing else. A sibling project's
purchase arrives, matches nothing, grants nothing. There is no shared database,
no shared service, and no cross-project lookup — the tag is the whole mechanism.

Two offers per project, both on the memberships shelf — the second is a
**one-time** level, which is what the provider calls a membership billed once
rather than on a cycle:

| Offer | Price | Grants |
| ----- | ----- | ------ |
| `<Tag> — Supporter` | $5 monthly · $50 yearly | supporter status, ends when they cancel |
| `<Tag> — Lifetime` | $99 once | supporter status, never revoked |

Same prices in every project — the tag is the only thing that differs.

**On the prices.** Lifetime must be a multiple of the yearly, never a discount
on it. It was first set at $35 against a $50 yearly, which is not a lifetime
price at all: it undercuts the annual, so the annual never sells, and it pays
back in seven months, so every long-term monthly supporter is better off
switching to it. $99 is two years of the yearly and less than two years of the
monthly — a real bet on the tool still being here, priced like one.

**Both fire `membership.started`.** A one-time level is still a membership, so
nothing special is needed to read it. `extra_purchase.created` stays subscribed
and configured anyway: it costs nothing, and it is what a Lifetime moved to the
Extras shelf would send. Moving it there is the escape hatch if the memberships
list gets crowded past three or four projects — two cards each adds up.

## What a supporter gets

Both offers grant the same thing — `pro` — and the price is the only difference
between them. `PRO_BENEFITS` (`src/config/pro.ts`) is the source of truth and is
what `/pro` prints:

- paste a list and let the queue run
- priority resolving on every link
- images and audio bundled into one ZIP
- no sponsor card, site-wide

The dashboard copy below says the same four things in plainer words, because
someone deciding whether to pay $5 will not click through to a features page to
find out what for. **Change this list and you change five places:**
`PRO_BENEFITS`, and then both levels' descriptions and both levels' rewards.

Every line is *less standing over it*, never more reach. Nothing a supporter
gets reaches content a visitor cannot already download, and nothing signs this
site into anywhere on their behalf. That constraint is not style — it is the
acceptable-use clause that got the paid version refused twice, so a reward or
description implying otherwise is a real problem, not loose copy.

What support does **not** buy, ever:

- `ig` — the operator's own Instagram session. Not on the list, not for sale, not
  reachable through any level (`migrations/0007_users_grants.sql`).
- anything that stops being free. Everything free today stays free whether
  anyone supports the project or not, and both descriptions say so.

**How it reaches them.** The webhook writes `pro` into `users.grants`; the
access token carries the entitlement and lives 15 minutes, so a grant lands
within one refresh — no deploy, no sign-out. If someone paid and does not have
it, check in this order: the `supporters` row exists (webhook worked), the
`users` row for the same address exists (they signed in with a different one),
`users.grants` contains `pro`.

```powershell
pnpm exec wrangler d1 execute social-media-downloader --remote --command "SELECT s.email, s.level, s.lifetime, u.id, u.grants FROM supporters s LEFT JOIN users u ON u.email = s.email WHERE s.email = 'buyer@example.com'"
```

A `NULL` in `u.id` is the common case and the one no code can fix: they paid
under one address and signed in with another. Move it by hand.

### Fill this in

| Field | This project | Where it lives |
| ----- | ------------ | -------------- |
| `<Tag>` | `Downloader` | `SUPPORT_TAG` in `src/config/support.ts` |
| Recurring level | `Downloader — Supporter` | derived, `SUPPORT_MEMBERSHIP` |
| One-time level | `Downloader — Lifetime` | derived, `SUPPORT_LIFETIME` |
| Membership URL | `https://buymeacoffee.com/vetteotp/membership` | `siteConfig.links.membership` |
| Webhook URL | `https://www.socialdownloader.space/api/billing/bmc` | dashboard |
| Secret | `BMC_WEBHOOK_SECRET` | Worker secret |
| What the tag replaces below | every `<Tag>` and every "this downloader" | copy blocks |

For the next project: change `SUPPORT_TAG`, name the two offers to match, and
re-read the copy for the words "this downloader".

The separator is an em dash, and the handler folds case, spacing and every kind
of dash before comparing — `Downloader - Supporter` typed with a hyphen still
matches. What it cannot survive is a different *word*.

The dashboard caps a description at **450 characters**. Both fit.

**Two things about how the card renders**, learned by looking at the live page
rather than the editor:

- **A blank line between a bullet list and a following paragraph collapses.**
  The closing sentence ends up glued to the last bullet. So every description
  below *ends* on its bullets and puts its closing thought first.
- **A reward's title and its description run together** with no separator. Each
  reward description therefore has to read as a whole sentence that follows its
  own title, never as a fragment completing it.

## Level 1 — Supporter (recurring)

**Name**

```
Downloader — Supporter
```

**Price** — `5` per month, `50` per year.

**Description** (361 characters)

```
$5 a month keeps this online. Everything stays free for everyone either way — you are just making it quicker for yourself, and possible for me.

What changes for you:
• Paste a whole list and walk away — the queue works through it
• Priority on every link, including the busy hours
• Photos and audio bundled into one ZIP
• No sponsor card, anywhere on the site
```

**Rewards** — six, in this order. The list is the card: someone scanning it
should be able to tell what changes for them without opening the description.
One benefit per reward, phrased as the thing they do rather than the feature
name.

**Reward 1**

```
Paste a list and walk away
```

```
The queue takes as many links as you want and works through them one after another. No feeding them in one at a time, no waiting for one to finish before you add the next.
```

**Reward 2**

```
Priority on every link
```

```
Your links go to the front of the resolve queue, so they start straight away — including at the busy hours when everyone else is waiting.
```

**Reward 3**

```
One ZIP instead of twelve files
```

```
Photo carousels and extracted audio come down as a single archive, already named. Nothing to gather up off your desktop afterwards.
```

**Reward 4**

```
No sponsor card, anywhere
```

```
The one ad on the site — the card that appears after a download — is gone site-wide, on every device you sign in on. That card is what pays for everyone else's downloads; your membership is what replaces it.
```

**Reward 5**

```
My personal number, and a say in what gets built
```

```
Supporters get my direct contact — message me any time, about anything. Ask for a feature and I will build it if it can be built. Supporters are a short list, so this is a real promise rather than a nice sentence.
```

**Reward 6**

```
Nothing to set up
```

```
Your status switches on automatically for the address you pay with, usually within minutes — sign in with that same address and it is already there. It covers this tool; my other projects have their own, at the same price.
```

**Welcome note** — the only place the number goes. A phone number in a public
reward description gets scraped within days; in here it reaches members and
nobody else. Replace the placeholder before saving.

```
Thank you — this is the part that keeps the lights on. 🎉

Nothing else to do: your supporter status switches itself on for the address you paid with, usually within minutes. If you sign in with a different address, reply here with the one you use and I'll move it across, same day.

Here is my direct line: <your WhatsApp / Telegram number>. Message me any time — something broken, something slow, or a feature you want. If it can be built, I will build it. That is the half of this I actually enjoy.
```

**Advanced settings** — free trial off, member limit off, Discord roles off.

## Level 2 — Lifetime (one-time)

A second membership level, set to bill **once** rather than on a cycle. It is
still a membership, so it has its own rewards list and fires the same
`membership.started` event.

**Name**

```
Downloader — Lifetime
```

**Price** — `99`, one-time.

**Description** (392 characters)

```
$99 once and that is the end of it. No renewal, no card on file, nothing to cancel — less than two years of the monthly, and then it never comes up again.

Everything the monthly gets, permanently:
• Paste a whole list and walk away — the queue works through it
• Priority on every link, including the busy hours
• Photos and audio bundled into one ZIP
• No sponsor card, anywhere on the site
```

**Rewards** — the same four benefits, then the two that only this level has.
Delete anything left over from an earlier version of this page; a stale reward
sitting under a new description is the fastest way to look careless.

**Reward 1**

```
Paste a list and walk away
```

```
The queue takes as many links as you want and works through them one after another. No feeding them in one at a time, no waiting for one to finish before you add the next.
```

**Reward 2**

```
Priority on every link
```

```
Your links go to the front of the resolve queue, so they start straight away — including at the busy hours when everyone else is waiting.
```

**Reward 3**

```
One ZIP instead of twelve files
```

```
Photo carousels and extracted audio come down as a single archive, already named. Nothing to gather up off your desktop afterwards.
```

**Reward 4**

```
No sponsor card, anywhere
```

```
The one ad on the site — the card that appears after a download — is gone site-wide, on every device you sign in on.
```

**Reward 5**

```
Paid once, yours for good
```

```
No renewal, no card left on file, nothing to cancel, and no email from me next year asking you to confirm anything.
```

**Reward 6**

```
Everything I add later
```

```
New supporter features land on your account automatically, at no extra cost, for as long as this thing runs.
```

**Reward 7**

```
My personal number, and a say in what gets built
```

```
Supporters get my direct contact — message me any time, about anything. Ask for a feature and I will build it if it can be built. Supporters are a short list, so this is a real promise rather than a nice sentence.
```

**Welcome note** — same rule as the other level: the number lives here, never in
a public reward description.

```
Thank you — that is a serious chunk of a year's running costs, in one go. 🎉

Nothing else to do, and nothing to renew: your supporter status switches itself on for the address you paid with, and it does not expire. If you sign in with a different address, reply here with the one you use and I'll move it across, same day.

Here is my direct line: <your WhatsApp / Telegram number>. Message me any time — something broken, something slow, or a feature you want. If it can be built, I will build it. You are on a very short list now.
```

Both notes still mention the sign-in address even though the webhook automates
the common case. They are the fallback for the case no code can fix: someone
whose Buy Me a Coffee address is not the address they sign in with.

## One-off coffees

A plain coffee — any amount, no membership, no extra — carries no name to match,
so it grants nothing automatically. That is deliberate: an untimed grant for a
one-time payment of an unknown size is how supporter status quietly becomes
free.

Handled by hand, and the hand-run write is an **expiring** window rather than a
grant, so it cannot be forgotten into permanence. Roughly a month per $5,
rounded down, minimum one month:

```powershell
pnpm exec wrangler d1 execute social-media-downloader --remote --command "UPDATE users SET sub_status = 'canceled', sub_ends_at = (strftime('%s','now') + 60*24*60*60)*1000, sub_updated_at = strftime('%s','now')*1000 WHERE email = 'buyer@example.com'"
```

`canceled` with a future `sub_ends_at` is exactly "paid through this date, then
stops" — `isProAt` already reads it that way (`src/lib/billing/entitlement.ts`),
so this needs no code and expires on its own. Adjust the `60` to the number of
days. It matches zero rows if they have never signed in, so check first:

```powershell
pnpm exec wrangler d1 execute social-media-downloader --remote --command "SELECT id, sub_ends_at FROM users WHERE email = 'buyer@example.com'"
```

Do **not** use `grants = 'pro'` for this. That column has no expiry, and it is
the membership's own channel.

Worth automating only if one-off coffees stop being occasional: subscribe
`donation.created`, read the amount, write the same two columns. It would also
need an expiry column on `supporters`, since a coffee usually arrives before the
account does.

## Cancellation recovery flow

Reached from the membership's Recovery tab. Fill three of the four.

- **Last-chance discount** — on, `20`.
- **Schedule a call** — skip. The field wants a real scheduler URL.
- **What you miss** — on.

  ```
  You'll go back to the free queue
  ```

  ```
  • The batch queue — links go one at a time again
  • Priority resolving on every link
  • ZIP bundles for carousels and audio
  • The sponsor card comes back
  ```

  This one is per-project by nature; it is the only block on the page that names
  features, and it is only ever read by someone already leaving.

- **Survey** — on. Two of the shipped defaults assume a content creator, so
  replace the set:

  ```
  The price no longer fits my budget
  I don't download often enough to need it
  The extras didn't work the way I expected
  A link I needed kept failing
  I got what I signed up for and I'm done
  Other
  ```

## Wiring the webhook

1. **Create the endpoint.** Dashboard → Integrations → Webhooks → Create.
   URL: `https://www.socialdownloader.space/api/billing/bmc`. Subscribe to
   `membership.started`, `membership.updated`, `membership.cancelled`,
   `membership.paused` and `extra_purchase.created`. Add the three
   `recurring_donation.*` events if recurring donations are ever enabled; the
   handler already knows them.

   `extra_purchase.created` is the one that carries the Lifetime. It also fires
   for every other item sold from the extras shelf, which is safe here only
   because the name still has to match the tag.

   One endpoint per project, each with its own secret. Every endpoint receives
   every event on the account; the name decides which one acts.

2. **Store the secret.** Each endpoint has its own.

   ```powershell
   pnpm exec wrangler secret put BMC_WEBHOOK_SECRET
   ```

   Until it is set the route answers `503` and grants nothing. It is never
   optional while the route is registered — an unverified webhook endpoint lets
   anyone grant themselves the extras.

3. **Apply the migration.** CI does not run migrations, and `d1_migrations`
   already disagrees with the schema on this database, so check what is
   actually there before trusting either.

   ```powershell
   pnpm exec wrangler d1 execute social-media-downloader --remote --command "SELECT name FROM sqlite_master WHERE name = 'supporters'"
   pnpm exec wrangler d1 migrations apply social-media-downloader --remote
   ```

   If the tracker refuses or tries to replay earlier migrations, run this file
   directly instead — it is `CREATE TABLE IF NOT EXISTS`, so it is safe either
   way:

   ```powershell
   pnpm exec wrangler d1 execute social-media-downloader --remote --file migrations/0008_supporters.sql
   ```

   Verify with the same `sqlite_master` query.

4. **Send a test event from the dashboard, then read what arrived.**

   ```powershell
   pnpm exec wrangler tail --format pretty
   ```

   This step is not optional, and it is the one thing the handler could not be
   written against. The envelope is documented — `event_id`, `type`,
   `live_mode`, `created` (epoch seconds), `attempt`, `data` — but the field
   names *inside* `data` are only published in an OpenAPI file behind the
   dashboard login. `pickEmail` and `pickLevel` in `src/lib/billing/bmc.ts`
   therefore search a list of plausible keys. Two log lines matter:

   - `bmc webhook: event type not handled <type>` — every event that is neither
     a grant nor a revoke, printed with the exact string the provider sent. Read
     this one first. The dashboard's event picker shows friendly labels
     ("Extra purchased", "Membership started"), never the string in the payload,
     so this line is the only place the real spelling appears. If a purchase you
     made logs here, copy the string into `GRANT_EVENTS` or `grantEvents`.
   - `bmc webhook: no email in payload` — no candidate key held an address. Add
     the real key to `EMAIL_KEYS` and it is fixed for every project at once.
   - `bmc webhook: level not configured here` — expected for a sibling
     project's purchase, and it prints the name so you can tell that apart from
     one of ours renamed. A `(none)` means `pickLevel` found no name at all;
     add the real key to `LEVEL_KEYS` or `LEVEL_OBJECTS`.

   The extras payload is the shakier of the two — an extra is not a membership
   level, so its name may well arrive under a key no membership event uses. The
   candidates already cover `extra_name`, `item_name`, `product_name` and the
   matching nested objects. **Buy your own Lifetime once** and read the log
   rather than waiting to find out from a supporter who paid $35 and got
   nothing.

5. **Let the delivery through the edge.** Cloudflare's Bot Fight Mode issues a
   `managed_challenge` to the provider's sender, and a challenged request never
   reaches the Worker: `wrangler tail` shows nothing at all, the endpoint looks
   dead, and the dashboard's response preview shows a Cloudflare interstitial
   instead of `ok`. This has now happened to two providers on this zone.

   The sender is `BMC-HTTPS-ROBOT` from AWS. `3.23.31.0/24` is allowlisted in
   **Security → WAF → Tools → IP Access Rules** with `mode: whitelist`, which is
   the only way to exempt anything from Bot Fight Mode on a Free plan — it
   cannot be scoped by path, and WAF skip rules do not apply to it.

   **This can drift.** If the provider ever sends from outside that range,
   grants stop silently. Nothing in the Worker logs will say so, because the
   Worker never runs. The one query that answers it:

   ```powershell
   $h = @{ Authorization = "Bearer $env:CLOUDFLARE_API_TOKEN"; 'Content-Type' = 'application/json' }
   $zid = (Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?name=socialdownloader.space" -Headers $h).result[0].id
   $body = '{"query":"query { viewer { zones(filter: {zoneTag: \"' + $zid + '\"}) { firewallEventsAdaptive(limit: 20, filter: {clientRequestPath: \"/api/billing/bmc\"}, orderBy: [datetime_DESC]) { datetime action source clientIP clientAsn userAgent } } } }"}'
   (Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/graphql" -Method POST -Headers $h -Body $body).data.viewer.zones[0].firewallEventsAdaptive
   ```

   Any row with `action: managed_challenge` and `source: botFight` is a
   delivery that never arrived. Allowlist the `clientIP` it reports.

   The permanent alternative, deliberately not taken: a second Worker with no
   assets, on its own `workers.dev` hostname, outside the zone entirely. It
   removes this failure class for good at the cost of a second deployment and a
   second copy of the secret. Worth revisiting if this drifts twice.

6. **Check the page after adding a project.** Each one adds a membership card
   and an extras card. Past three or four projects the page stops being
   readable, and the exit is a Buy Me a Coffee account per project — fully
   generic names, separate payouts and stats, at the cost of a payout setup
   each time. The tag scheme is what avoids that work, not a claim that it
   scales forever.

## What happens on a real event

```
membership.started / extra_purchase.created
  → signature verified over the raw bytes (x-signature-sha256)
  → email + offer name pulled out of `data`
  → name matched against this project's BMC_LEVELS   ← ours, or nothing happens
  → row written to `supporters`   ← the durable record, keyed by email
  → users.grants updated for every account with that address, if any exist yet
```

Support almost always arrives before the account does, because nothing on the
page asks anyone to sign in first. That is why `supporters` exists as its own
table: the grant is recorded against the address either way, and
`claimSupporterGrants` applies it the moment that address signs in
(`src/lib/auth/routes.ts`). The old hand-run
`UPDATE users SET grants = 'pro' WHERE email = ?` matched zero rows in exactly
that window and reported success.

`supporters.level` stores the name as it arrived, so the row records which
project's offer was bought — that column is the audit trail, and it is why no
separate project column exists.

Guarantees worth knowing:

- **Support unlocks one project.** An unrecognised name grants nothing — there
  is no fallback tier by default (`fallback: null`). The cost of that runs the
  other way and is real: an offer renamed in the dashboard, or a payload whose
  name we cannot read, drops a paying supporter. It is logged, not silent.
- **A sibling project's cancellation cannot revoke this one.** A cancellation
  naming an offer we do not know is ignored. One that names no offer at all is
  acted on, because refusing every unnamed cancellation is how a membership
  becomes permanent.
- **Lifetime is never revoked.** `supporters.lifetime` refuses it, which matters
  because a member can remove an extra from their account and the provider still
  emits a cancellation.
- **`ig` is never touched.** Grants are a set, and the writes add or remove one
  name rather than assigning the column (`withGrant` / `withoutGrant`). The
  hand-run `UPDATE ... SET grants = 'pro'` in the README does assign it, so it
  still detaches `ig` from an account that had both — prefer the webhook.
- **Redeliveries and out-of-order events are no-ops.** Guarded on `event_id`
  and on the envelope's `created`, so a retried cancel cannot undo a membership
  that started after it.
- **A grant is never sold, only thanked for.** Nothing here may map an offer to
  `ig`; see `migrations/0007_users_grants.sql`.

## What has actually been tested

Run against a real Worker (`wrangler dev`) and a real D1, not a mock, on
2026-08-15 — 36 checks, all passing:

- a body signed with the wrong secret, and one with an empty signature header,
  are refused with `401` and write nothing;
- a membership for a supporter with no account is recorded in `supporters`;
- a membership for an existing account writes `pro` into `users.grants`, and
  leaves `ig` in place;
- `Downloader - Supporter` with a plain hyphen matches;
- a sibling project's membership and its cancellation both change nothing here;
- an extras purchase of the tagged Lifetime grants and is marked unrevocable; an
  extras purchase of something else grants nothing;
- a cancellation deletes the row and removes only `pro`; a cancellation of a
  lifetime is refused;
- a redelivered `event_id` is a no-op, and an event older than the stored one
  cannot revoke;
- unparseable body `400`, oversized body `413`, unhandled event type `200`, an
  event with no readable email `200` and no write;
- `claimSupporterGrants` run inside the runtime: support paid before the account
  existed lands at sign-in, is idempotent, and never drops `ig`;
- the one-off coffee command sets a window ~60 days out.

Both `bmc webhook: level not configured here` warnings appeared in the log with
the offending name printed, which is the operator's only signal that something
was dropped.

Then against **production**, after deploying: unsigned and forged signatures
refused with `401 bad signature` from the handler itself; a sibling project's
level accepted and ignored; our own level written to `supporters` with
`grants=pro`; the cancellation deleting the row. Test rows removed after.

**The real payload is confirmed.** A `membership.started` test event sent from
the dashboard on 2026-08-15 reached the handler, verified against our HMAC, and
logged `level not configured here membership.started Basic` — `Basic` being the
provider's own test fixture. That single line proves four things at once: the
signature scheme matches, the event type really is spelled `membership.started`,
`pickEmail` found an address (the handler never reaches the level check
otherwise), and `pickLevel` found a name rather than `(none)`. Nothing in
`EMAIL_KEYS` or `LEVEL_KEYS` is a guess any more.

**What is still untested:** a real purchase of a real level, end to end. The
dashboard's fixture always says `Basic`, so the one path never exercised is the
one where the name actually matches and an account gets entitled. Buying your
own monthly and cancelling it is the only way to close that gap.

## Reusing this in another project

`src/lib/billing/bmc.ts`, `src/lib/billing/hmacWebhook.ts` and
`src/config/support.ts` are the whole implementation, and all three are written
to be copied. What a host project owes them:

- a `supporters` table — `migrations/0008_supporters.sql`, verbatim;
- a `users` table with `email` and a comma-separated `grants` column;
- `withGrant` / `withoutGrant` from `src/lib/billing/entitlement.ts`, which are
  twenty lines and dependency-free;
- ten lines of wrapper. `handleBmcWebhook` at the bottom of `bmc.ts` is the
  only part tied to this repo — it reads `requireDb` and `process.env`. Replace
  it and call `bmcWebhook(request, db, config)` directly.

Then change one line:

```ts
// src/config/support.ts
export const SUPPORT_TAG = 'Notes'
```

which gives `Notes — Supporter` and `Notes — Lifetime`. Create those two offers
in the dashboard under exactly those names, point a new webhook endpoint at the
new project, and it is done.

The one setting to leave alone is `fallback`. It defaults to `null` — an
unrecognised name grants nothing — and that default is what keeps one membership
from unlocking every project on the account. Set it only on an account that will
never serve a second project.
