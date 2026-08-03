# Accounts and Subscriptions Design

Date: 2026-08-02
Status: approved, pending implementation plan
Supersedes: the "Pro license" layer of `2026-07-31-monetization-design.md`

## Goal

Replace the $9 one-time Lemon Squeezy license key with a $3/month (or $24/year)
subscription, bought and held behind a Google account.

The license key had three problems. A key is a bearer credential with no personal
cost to share, so a buyer can hand it to ten people at no risk to themselves. A
lost key — cleared browser storage, a wiped device — is a support ticket, because
nothing on our side knows who owns it. And a one-time payment cannot fund ongoing
work.

An account fixes all three at once, and not because accounts are inherently more
secure. Sharing a Google account means handing over your email, your Drive, your
everything: the credential now costs the sharer something. Recovery becomes "sign
in again". And a subscription is revocable, which a sold key never was.

The downloader itself stays anonymous. No login, no signup, nothing stored — for
free users nothing changes at all. Login exists only on the Pro path.

### Non-goals

- Email/password, magic links, or any provider other than Google.
- Accounts for free users.
- Any tracking of what anyone downloads.
- A self-built billing UI. Lemon Squeezy hosts the checkout and the portal.
- Migrating existing license keys. There are zero sales, so the license system is
  deleted outright rather than carried forward.

## Performance budget

This is the governing constraint, not a quality bar to check at the end. The free
plan allows 10 ms of CPU per request, and this project has already been bitten
once: Next's lazy server init billed 129 ms to whichever request happened to
trigger it, per isolate, which is why `API_ROUTES` exists at all. The same class
of mistake is available again here, so the rules are stated before the design
that has to obey them.

### Hard rules

1. **A page view invokes no Worker.** Static assets are matched before the Worker
   runs. `/account` is a static export like every other page; `run_worker_first`
   stays `["/api/*"]` and gains nothing. Nothing about being signed in may put a
   page view on the Worker — this is why the header reads a hint cookie rather
   than calling an endpoint.
2. **`/api/download` gains zero work.** Not one extra byte parsed, no database, no
   new import. It keeps exactly the one HMAC verify over ~60 bytes it does today.
   Every measurement below is relative to that being untouched.
3. **Auth code is never imported at module scope.** See below — this is the trap.
4. **Verify the signature before parsing the body.** The webhook HMACs raw bytes
   and only calls `JSON.parse` once the signature holds. Parsing first would let
   an unauthenticated caller spend our CPU on an arbitrarily large payload.
5. **No new dependency on any path `/api/download` can reach.**
6. **The header control ships on every page, so it must be nearly free.** It is the
   only client-side code this work adds to pages that are otherwise static: a
   cookie read and two possible renders, no new dependency, no network call, no
   layout shift. The mobile Lighthouse score is 96 and must still be 96 after.

### The import trap

Module-scope initialisation is billed to the first request that loads the module,
in every isolate, forever — that is precisely how the 129 ms Next figure happened.
`API_ROUTES` is a single table imported by the Worker entrypoint, so a naive
`import * as arctic from 'arctic'` at the top of `src/lib/auth/routes.ts` would be
evaluated on **every** isolate's first request, including a plain anonymous
`/api/download`.

So the auth handlers `await import()` arctic inside the handler body, not at module
scope. An isolate that only ever serves downloads never loads the OAuth client at
all. The route table holds function references; it must not pull their dependencies
in with it.

The same applies to anything else heavy that lands in auth or billing code.

### Budget per path

| Path | Frequency | CPU | Of budget |
|------|-----------|-----|-----------|
| page view | every visit | 0 ms — Worker not invoked | 0% |
| `/api/download` | every resolve | unchanged: 1 HMAC over ~60 B | unchanged |
| `/api/auth/refresh` | on activity, ≤1 per 15 min | cookie parse, 1 SHA-256, 1 HMAC sign; D1 is I/O; reconcile is deferred to `waitUntil` | <1 ms |
| `/api/auth/callback` | once per login | arctic import, TLS exchange (I/O), JWT decode, 2 writes (I/O) | ~2–3 ms |
| `/api/billing/webhook` | a few per day | 1 HMAC verify, 1 parse, 1 write | <1 ms |
| `/api/billing/portal` | on click | 1 LS API call (I/O) | <1 ms |

Cloudflare does not bill time spent waiting on I/O, so D1 queries, the Google token
exchange, and the Lemon Squeezy API call cost wall-clock latency but no CPU. The
only billable work in this entire design is cookie parsing, one hash, one HMAC, and
one small JSON parse.

### How this gets verified

A Worker cannot time itself — `Date.now()` does not advance during synchronous
execution on workerd. Actual CPU comes from `wrangler tail`'s `cpuTime` field
against a preview deployment, which is the method already used in this project to
produce the 129 ms and 92 ms figures.

Before merge, `cpuTime` is captured for: an anonymous `/api/download` (must match
the pre-change baseline), a `/api/download` carrying a valid token, a cold-isolate
`/api/auth/callback`, and `/api/auth/refresh`. A regression on the first of those
is a blocker regardless of how the others look — the download path is the product.

## Product

Pro is $3/month or $24/year. Annual is the default in the UI, for a reason worth
recording: Lemon Squeezy charges 5% + 50¢, so the flat fee costs 22% of a $3
charge but only 7% of a $24 one.

| SKU | Gross | Fee | Net | Kept |
|-----|-------|-----|-----|------|
| $3/mo | $3.00 | $0.65 | $2.35 | 78% |
| $24/yr | $24.00 | $1.70 | $22.30 | 93% |

Twelve monthly charges net $28.20 against $22.30 for an annual. Annual is worth
79% of the revenue while removing eleven chances to churn and eleven flat fees.

Pro keeps its four existing benefits (priority resolve, batch up to 20, no sponsor
card, login-gated Instagram) and adds two that make recurring payment make sense,
since three of the original four cost nothing to serve and would not survive a
monthly renewal decision on their own:

- **Feature requests.** Pro subscribers can ask for features and get a real answer.
- **Direct access.** A scheduled call with the developer — **annual subscribers
  only**, via a booking link with a capped number of slots per month. Deliberately
  bounded: an open-ended offer of synchronous time at $3/month is a promise that
  breaks at 200 subscribers.

## Architecture

Three credentials with three lifetimes. The important property is that the
download path never touches the database.

```
Google  ──1──▶ /api/auth/callback ──▶ D1: upsert user, insert session
                      │                    └─▶ Set-Cookie: session (httpOnly, 90d)
                      ▼
              302 back to the app

client ──2──▶ /api/auth/refresh  (cookie) ──▶ D1: session live? subscription active?
                      │
                      ▼
              { token, exp }  — 15 minutes, HMAC, held in memory only

client ──3──▶ /api/download   X-Pro-Token: <token>  ──▶ verify HMAC. No D1.
```

**Session cookie** — `httpOnly; Secure; SameSite=Lax; Path=/`, 90 days. The
long-lived credential. `httpOnly` puts it out of reach of JavaScript, so an XSS
bug cannot lift it. Deleting its row is the DB logout.

**Access token** — 15 minutes, held in a JavaScript variable and never persisted.
Reuses `signToken`/`verifyToken` from `src/lib/licenseToken.ts` unchanged; only
the payload moves from `{k, exp}` to `{u, exp, p}`, where `p` is the boolean
"this user is Pro right now". Because the token carries the entitlement, the
download path needs no database read, and entitlement staleness is bounded by the
15-minute TTL.

**Google's tokens** — discarded the moment the callback finishes. We do not
request `access_type=offline` and never store a Google refresh token. Google
answers "who is this" exactly once; everything after that is our session. This is
what makes revocation actually work: nothing about continued access depends on
Google.

### Why the refresh is lazy, not scheduled

A 15-minute interval timer would be 96 requests per user per day. At 1,000 Pro
users that is 96,000 requests/day against a 100,000/day free-plan cap — the
heartbeat alone would consume the entire request budget the downloader needs.

Instead the client refreshes only when it is about to do something and its token
is stale or near-stale. Refreshes scale with activity, not with wall-clock time.
Revocation still lands within 15 minutes *of the user doing anything*, which is
the only window that matters — a revoked user sitting on an idle tab is not
consuming anything.

### Lazy reconcile: webhooks are an optimisation, not the truth

Lemon Squeezy retries failed deliveries, but a webhook can still be lost for good —
a deploy window, a bad response we returned, an endpoint misconfigured for an hour.
If webhooks were the only writer, a lost one would leave a row permanently wrong:
someone who cancelled keeping Pro, or worse, someone who paid not getting it.

So `/api/auth/refresh` also repairs. When it loads a user who has an
`ls_subscription_id` and whose `ls_updated_at` is older than 24 hours, it schedules
`GET /v1/subscriptions/{id}` against the Lemon Squeezy API through
`ctx.waitUntil()` and writes the authoritative status back. The token for *this*
request is minted from the row as it stands; the repair lands before the next one,
at most 15 minutes later.

Three properties make this the right shape:

- **It costs nothing when webhooks work.** The check is an integer comparison. The
  fetch only fires on a row that is already stale, which in normal operation is
  never — every webhook refreshes `ls_updated_at`.
- **It is off the response path.** `ctx.waitUntil()` defers it past the response,
  the same mechanism `/api/download` already uses for edge-cache writes. The user
  waits for nothing.
- **It repairs exactly the accounts that matter.** Reconciling is driven by someone
  actually using the site. A user who never returns cannot be harmed by a stale
  row, because entitlement requires a refresh they never make.

**Forced reconcile** covers the worst case directly. The checkout-success poll
described under *Returning from checkout* calls `/api/auth/refresh?reconcile=1`
after ~10 seconds of no change, which skips the staleness check and asks Lemon
Squeezy outright. "I paid and nothing happened" is the one failure a customer will
not wait out, and it resolves in a single round trip instead of a support email.

Deliberately **not** a Cron Trigger. A scheduled sweep would need a `scheduled`
handler on the Worker entrypoint, would walk every subscriber on a timer, and would
spend most of its work confirming rows that were already correct — to fix accounts
whose owners are not there to notice. Demand-driven repair is less code, less
infrastructure, and better targeted. It reuses `LEMONSQUEEZY_API_KEY`, already
needed for the portal, so it adds no new configuration at all.

### Why not Better Auth

It was considered and rejected. Better Auth solves sessions, OAuth, and
revocation, and would mean owning no security-critical code. But it brings its own
schema which we would then mint our own resolve token on top of, its default
session model is a database read per request (exactly what the hot path must
avoid), and it is a substantial dependency in a Worker deliberately kept small —
`axios` was previously removed from this project for costing half the CPU budget.

`arctic` (~10 KB, edge-native, the OAuth layer Better Auth itself builds on)
handles the part genuinely worth not hand-rolling: the Google authorization code
exchange with PKCE, state, and nonce. Sessions are ~90 lines of SQL against a
four-column table, reusing the HMAC signer already in the codebase and already
tested.

## Data model

Two tables. `migrations/0001_accounts.sql`.

```sql
CREATE TABLE users (
  id                  TEXT PRIMARY KEY,   -- crypto.randomUUID()
  google_sub          TEXT NOT NULL UNIQUE,
  email               TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  prefs               TEXT,     -- JSON: { quality, format }. See "Signed-in extras".

  -- Billing, denormalised onto the user: exactly one subscription per user,
  -- so a separate table would be a join bought for nothing.
  ls_subscription_id  TEXT UNIQUE,
  ls_status           TEXT,     -- active|on_trial|past_due|cancelled|paused|unpaid|expired
  ls_variant          TEXT,     -- monthly|annual
  ls_renews_at        INTEGER,
  ls_ends_at          INTEGER,  -- set when cancelled: Pro remains valid until this
  ls_past_due_since   INTEGER,  -- first past_due sighting; grace is capped from here
  ls_updated_at       INTEGER   -- webhook replay guard, and reconcile staleness clock
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,   -- SHA-256 of the cookie value, never the value
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

That is the entire set of stored data: identity, subscription state, and which
devices are signed in. No IP addresses, no download history, no passwords (Google
holds those), no Google tokens.

Session IDs are stored hashed, so a leaked database read does not hand anyone a
working session. Revocation is a hard `DELETE`, not a `revoked_at` flag — a soft
delete would put a `WHERE revoked_at IS NULL` on every query in exchange for
history nobody reads.

**Indexes are load-bearing, not hygiene.** D1 bills rows *scanned*, not rows
returned, so an unindexed lookup bills the whole table on every request. Every
column used in a `WHERE` is a primary key or has an index above.

### Rejected from the schema

Recorded so these are not re-proposed later:

- **IP tracking.** Considered for detecting shared accounts. Dropped: the
  five-session cap already bounds sharing to five devices regardless of location,
  so the signal would not have changed any decision. Dropping it also made
  `/api/auth/refresh` a pure read, removed the only per-request write in the
  design, and kept IP addresses — personal data under GDPR, with a retention
  window to define and a lawful basis to argue — out of the system entirely.
- **A `device` label** ("Chrome · Windows"). Existed only to make rows legible in
  a device-list UI that is not being built.
- **A device-list UI.** ~150 lines of React for a feature the owner has said they
  will not use. `/account` gets "Sign out" and "Sign out everywhere"; killing one
  specific session is a D1 query.
- **`ls_portal_url`.** Lemon Squeezy's `urls.customer_portal` is a *signed* URL
  that expires after 24 hours, and their documentation says not to store it.
  Cached, the "Manage billing" button would be dead a day after the last webhook.
  Fetched fresh per click instead, via `/api/billing/portal`.

## Entitlement

One pure function, `isProAt(user, now)`. Nothing else in the codebase decides who
is Pro.

| `ls_status` | Pro? | Until |
|-------------|------|-------|
| `active`, `on_trial` | yes | — |
| `cancelled` | yes | `ls_ends_at` |
| `past_due` | yes | `ls_past_due_since + 14 days` |
| `paused`, `unpaid`, `expired` | no | — |
| no subscription | no | — |

Two entries need justifying.

**`cancelled` is still Pro until `ls_ends_at`.** In Lemon Squeezy, `cancelled`
means *will not renew*, not *stopped now*. The customer has already paid through
the end of the period. Cutting them off at the moment they click cancel is
charging for service and not delivering it.

**`past_due` keeps Pro for up to 14 days.** Lemon Squeezy retries a failed payment
four times over two weeks before flipping to `unpaid`, and most of those retries
succeed — an expired or momentarily declined card is the largest single cause of
involuntary churn, and it is not a decision to leave. Switching Pro off the
instant a renewal fails punishes customers for something their bank did, in the
window where LS is actively fixing it on our behalf.

The 14-day cap is ours, not LS's, and it exists because "serve Pro until Lemon
Squeezy says otherwise" has no bound if something upstream breaks — a changed
retry schedule, a wedged subscription, a webhook that never lands. `ls_past_due_since`
is stamped the first time we see the status and cleared when it recovers, so the
grace window is measured from an event we observed rather than inferred. In normal
operation LS resolves the subscription first and the cap never fires.

`isProAt` is unit-tested across every status and both sides of every date
boundary, including a `past_due` user at 13 days, at exactly 14, and at 15. It is
the one place where a mistake either gives away paid service or takes it from
someone who paid.

## Endpoints

All seven are added to `API_ROUTES` in `src/lib/apiRoutes.ts`, so the Worker serves
them without initialising Next — the same reason the existing routes are there
(Next's lazy init was measured at 92–129 ms of CPU against a 10 ms budget).

| Route | Method | Does |
|-------|--------|------|
| `/api/auth/google` | GET | Generate state + PKCE verifier, set both as short-lived `httpOnly` cookies, 302 to Google |
| `/api/auth/callback` | GET | Validate state, exchange code, decode `id_token`, upsert user, create session, set cookie, 302 back |
| `/api/auth/refresh` | POST | Cookie → session → user → `isProAt` → 15-minute access token. Reconciles a stale row via `waitUntil`; `?reconcile=1` forces it |
| `/api/auth/logout` | POST | Delete this session (or all with `?all=1`); clear both cookies |
| `/api/account` | POST | Update `prefs`, or delete the account |
| `/api/billing/portal` | GET | Fetch a fresh signed LS portal URL and 302 to it |
| `/api/billing/webhook` | POST | Verify `X-Signature`, apply the subscription state change |

`/api/auth/callback` is handled by the Worker directly and 302s on completion, so
no static callback page is needed. The `id_token` is decoded without verifying its
signature, which is correct here and worth stating explicitly: it arrived over TLS
as the direct response to a server-side token request authenticated with our
client secret. There is no untrusted path it could have come through.

The five-session cap is enforced at session creation: if the user already has five
live sessions, delete the oldest. One extra query and one extra write, at login
only.

## User experience

The downloader never prompts, never shows a modal, never blocks anything behind
an account. Signing in is available, never demanded.

### The header entry point

The header gets one control on the right: **"Sign in"** when signed out, a small
circular avatar when signed in, opening a two-item menu: Account and Sign out.
(Settings is a section of `/account`, not a separate destination — see below.)

Two constraints shape how it is built, and both come from properties this project
already protects.

**It must cost zero requests.** The site is a static export served from
Cloudflare's asset store — page views currently invoke no Worker at all, which is
what keeps them off both the CPU budget and the 100,000 requests/day cap. A header
that called `/api/auth/refresh` on every page load would put every page view back
on the Worker and spend the request budget on rendering an avatar.

So login sets a second cookie alongside the session: `smd_account=1`, readable
from JavaScript, no user data in it, purely a hint. The header reads it
synchronously and renders the right control with no network call. It is not a
credential and is never trusted for anything — every real decision still requires
the `httpOnly` session cookie, server-side. Worst case someone forges the hint and
sees an avatar that leads to a page telling them to sign in.

**It must not flash or shift.** The header is prerendered static HTML, so signed-in
state cannot be server-rendered. Rendering "Sign in" first and swapping to an
avatar is both a visible flicker and a layout shift on a site holding a 96 mobile
Lighthouse score. The control therefore occupies a fixed-size slot that renders
empty until the cookie is read on the first client pass — the same `useHydrated`
discipline `PromoSlot` already uses to avoid exactly this.

### Signed-in extras

An account should be worth having before anyone pays. The honest list of what
genuinely benefits from one is short, and stays short on purpose.

**Preference sync** — default quality (HD/SD) and default format (video/audio),
today held in `localStorage` and therefore per-browser. Stored as one JSON column
on `users`, they follow the person across devices. On first login, local
preferences are merged up rather than overwritten, so signing in never silently
changes how the tool behaves.

That is the whole list, and one thing is **explicitly rejected**: syncing download
history. It is the obvious next idea and it is the wrong one. "We never record what
you download" is a stated privacy property of this site and a real reason people
use it. Trading it for a convenience feature would be a bad deal even as an opt-in,
because the promise stops being unconditional the moment there is a switch.

Settings live in a section of `/account` rather than a separate `/settings` page.
Two pages would mean two routes, two layouts, and a navigation decision, for
content that fits in one card.

### `/account` states

One page, three sections: **Plan**, **Preferences**, and **Account** (email, sign
out, sign out everywhere, delete account). Preferences and Account look identical
whether or not the person pays; only Plan changes.

Plan is a function of `isProAt` plus `ls_status`. Every state names the date it
changes and offers exactly one action.

| State | Shows | Action |
|-------|-------|--------|
| Signed in, no subscription | "You're on the free plan." | Choose monthly or annual |
| `active` monthly | "Pro · $3/month · renews 3 Sep" | Manage billing |
| `active` annual | "Pro · $24/year · renews 3 Aug 2027" + booking link | Manage billing |
| `cancelled` | "Pro until 3 Sep. Won't renew after that." | Resubscribe |
| `past_due` | "We couldn't take payment. Pro stays on until 17 Aug." | **Update payment method** |
| `unpaid` / `expired` | "Your subscription ended." | Subscribe again |

`cancelled` is deliberately not phrased as a loss. The customer paid through the
period and still has everything; the copy states the end date rather than warning
them about it, and offers one button to undo.

`past_due` gets the loudest treatment on the page, and it is the one state that
also surfaces outside `/account`: a slim banner on the downloader itself, because
someone in the grace window is still using Pro normally and has no reason to visit
their account page before it runs out. It names the date Pro stops and leads with
the fix rather than an explanation — nothing stands between them and working
software except a card update, and they probably don't know yet.

That banner is the only thing this entire design is ever allowed to interrupt the
downloader with, and only for someone who is already paying.

### Cancelling

Cancellation happens in Lemon Squeezy's hosted portal, not here. That is a
deliberate omission rather than a gap: a self-built cancel flow means handling
confirmation, proration, reactivation, and payment-method edits, all of which LS
already does correctly and keeps in sync with its own billing state.

What matters for UX is that returning from the portal is not confusing. The portal
sends the customer back, the webhook lands within seconds, and `/account` shows
"Pro until 3 Sep". If the webhook has not arrived yet, the page shows the
activating state below rather than stale information.

### Returning from checkout

The gap between paying and the webhook arriving is the one moment this design can
look broken — the customer has paid and the database does not know yet.

Lemon Squeezy redirects to `/account?checkout=success`. On that parameter the page
shows "Setting up your subscription…" and re-calls `/api/auth/refresh` on a short
backoff for up to 30 seconds. Almost always the webhook wins that race and Pro
appears within a second or two. If it does not, the copy becomes "Your payment
went through. This can take a minute — refresh, or email us if it persists," which
is honest and does not imply the money went nowhere.

The same 15-minute token TTL means a subscription bought in one tab activates in
another within 15 minutes without any coordination between them.

### Signing in

`/api/auth/google` accepts a `redirect_to` parameter so a user who clicked "Get
Pro" from a platform landing page returns to where they were. It is validated
against the site's own origin and rejected otherwise — an unvalidated redirect
parameter on an auth endpoint is a textbook open redirect, and phishing through
it would be more damaging here than anywhere else on the site.

"Sign out everywhere" asks for confirmation, since it is the one destructive
control on the page. Deleting the account is available and cascades sessions; it
does not cancel a live subscription, so it warns and links to the portal first.

#### `handle_links` must stay `not-preferred`

The manifest used to declare `"handle_links": "preferred"`, which asks the
platform to route every in-scope URL into the installed app rather than the
browser. The OAuth callback is an in-scope URL, and it arrives as a top-level
navigation from `accounts.google.com` — so on Android the return leg of a
sign-in started in Chrome was captured by the installed PWA. The user landed
signed in inside the app, and the Chrome tab was left spinning on Google's
domain forever, because the navigation it was waiting on had been handed to
another process.

Nothing this site needs depends on link capturing: the app is launched from its
home-screen icon and, far more often, through `share_target` — which is a
separate intent filter and is unaffected. Signing in *from inside* the PWA is
also unaffected: that flow leaves and re-enters scope within the app's own
browsing context, which is scope handling rather than link capturing. The only
thing given up is that a link to the site tapped in another app now opens the
browser instead of the app.

Note that this is baked into the Android WebAPK at install time, so an existing
install keeps the old behaviour until Chrome next updates it (roughly a day).
`useOnPageVisible` is the belt-and-braces for that window, and for a sign-in
that genuinely happened in another tab: both `AccountControl` and
`AccountPanel` re-read the session when their page becomes visible again, so
whichever document was left behind stops showing "Sign in" to somebody who is
already signed in. The control's re-read costs no request at all — the hint
cookie and the profile cache are both shared with the app.

## Failure handling

- **Refresh fails on a network error** → keep the existing token and degrade to
  free at its natural expiry. A paying customer is never downgraded because of one
  flaky request. This mirrors the fail-safe posture already documented in
  `maybeRevalidate`.
- **A webhook is missed** → self-healed by lazy reconcile (see *Architecture*).
  Webhooks are treated as an optimisation, not as the source of truth.
- **A webhook is replayed** → guarded by `ls_updated_at`; an event older than the
  stored value is dropped. Lemon Squeezy retries on any non-2xx, so handlers must
  be idempotent regardless.
- **Webhook signature** → HMAC-SHA256 over the raw body against `X-Signature`,
  compared with `crypto.subtle.verify` for constant-time comparison. The same
  WebCrypto primitive already used by `verifyToken`. Never skipped, in any
  environment; an unverified webhook endpoint lets anyone grant themselves Pro.
- **Checkout with no `custom_data.user_id`** → should be impossible, since
  checkout requires being signed in first. If one arrives, fall back to matching
  on the customer's email and log it.
- **State or PKCE mismatch on callback** → 400 and start over. Never fall through
  to creating a session.
- **Google returns no email** → reject the login. `email` is `NOT NULL` and is the
  fallback for orphaned webhooks.

## What changes in the codebase

**Deleted**

- `src/components/ProLicensePanel.tsx`
- `src/app/api/license/route.ts`
- `handleLicense()` and the Lemon Squeezy license API calls in `src/lib/apiRoutes.ts`
- `hashKey()` in `src/lib/licenseToken.ts`
- `activateLicense`, `readLicense`, `saveLicense`, `clearLicense`, `StoredLicense`,
  `needsRevalidation`, `maybeRevalidate` in `src/lib/entitlements.ts`
- `scripts/ls-finish.mjs` — it verifies a live variant's *license* settings, which
  will no longer exist

**Kept unchanged**

- `signToken` / `verifyToken` and their tests. Already the right primitive.
- The public shape of `useTier()` and `useProToken()`. `DownloaderApp` and
  `PromoSlot` consume those hooks and do not change at all — the abstraction that
  makes this migration cheap is already in place.
- `/api/download` and every other resolve path.

**New**

- `migrations/0001_accounts.sql`
- `src/lib/auth/google.ts` — arctic wrapper, ~40 lines
- `src/lib/auth/session.ts` — D1 queries, ~90 lines
- `src/lib/auth/routes.ts` — the four auth handlers plus `/api/account`, ~150 lines
- `src/lib/billing/webhook.ts` — signature verify + state apply, ~70 lines
- `src/lib/billing/portal.ts` — fresh signed portal URL from the LS API, ~25 lines
- `src/lib/billing/reconcile.ts` — staleness check + LS subscription re-sync, ~35 lines
- `src/lib/billing/entitlement.ts` — `isProAt`, ~35 lines
- `src/components/PastDueBanner.tsx` — the one interruption Pro users can see
- `src/app/account/page.tsx` + `src/components/AccountPanel.tsx` — the Plan,
  Preferences, and Account sections
- `src/components/AccountMenu.tsx` — the header control: "Sign in", or an avatar
  with a menu. Reads the `smd_account` hint cookie, renders into a fixed-size slot

**Edited**

- `src/lib/apiRoutes.ts` — route table; `isPriorityRequest` reads the new payload
- `src/lib/entitlements.ts` — rewritten around the session cookie
- `wrangler.jsonc` — `d1_databases` binding
- `src/config/pro.ts` — two checkout URLs, monthly and annual
- `src/app/pro/page.tsx` — "One key. Lifetime." → subscription copy; "5
  activations" → "5 devices"; the two new benefits
- `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` — see below
- `scripts/cf-smoke.mjs` — the `/api/license` assertion is replaced with
  equivalents for the auth routes
- `.env.sample`, `.env.cloudflare.sample`, `README.md`

Net: roughly +600 lines added, ~350 deleted, one dependency.

## Configuration

New secrets. `LICENSE_TOKEN_SECRET` is renamed to `PRO_TOKEN_SECRET`, since
licenses no longer exist; the old one is removed after the new one is set.

| Name | Where | Purpose |
|------|-------|---------|
| `GOOGLE_CLIENT_ID` | Worker secret | OAuth client |
| `GOOGLE_CLIENT_SECRET` | Worker secret | OAuth client |
| `PRO_TOKEN_SECRET` | Worker secret | HMAC for access tokens and session-cookie values |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Worker secret | `X-Signature` verification |
| `LEMONSQUEEZY_API_KEY` | Worker secret | Fresh customer-portal URLs, and lazy reconcile |

`LEMONSQUEEZY_API_KEY` is new to this project. Both `.env.sample` and
`.env.cloudflare.sample` currently state that no Lemon Squeezy API key is needed
anywhere, which was true of the license endpoints (they authenticated with the
customer's own key) and is no longer true. Those comments must be corrected, not
just appended to.

Dashboard work, which is where the real time goes — the code is the easy part:

1. Google Cloud console: OAuth client, consent screen, and **both** redirect URIs
   (`http://localhost:3000/api/auth/callback` and the production origin). Mismatched
   redirect URIs between dev and production are the single most likely thing to
   break here.
2. Lemon Squeezy: convert the product to a subscription with monthly and annual
   variants, disable license key generation, register the webhook endpoint with the
   signing secret, and subscribe to the `subscription_*` events.
3. Cloudflare: create the D1 database, apply the migration, add the binding, set
   the five secrets.

## Cost

Measured against the free plan, at a hypothetical 10,000 subscribers (~$23k/month
net), to establish that scale is not a constraint on this design.

| Resource | Free tier | Used at 10k subs | Headroom |
|----------|-----------|------------------|----------|
| D1 rows read | 5M/day | ~200k/day | 4% |
| D1 rows written | 100k/day | ~3k/day | 3% |
| D1 storage | 5 GB | ~12 MB | 0.2% |
| Worker CPU | 10 ms/request | <3 ms worst path | fine |

CPU is not a concern because Cloudflare does not bill time spent waiting on I/O.
D1 queries and the Google token exchange are I/O; only JSON parsing and HMAC work
is charged. `/api/download` is unchanged at one HMAC verify over ~60 bytes.

Writes are near zero because they happen only at login and on a webhook — a direct
consequence of dropping IP tracking, which was the design's only per-request write.

The binding constraint is unrelated to this work: the 100,000 Workers
requests/day cap, already spent by download traffic. Auth adds roughly one refresh
per active session per 15 minutes of use. When it is outgrown, Workers Paid is $5/
month, covered by three subscribers.

## Privacy and terms

The site becomes a data controller, which it currently is not, and `privacy` sells
that fact. The rewrite must distinguish the two cases plainly: free users are still
fully anonymous with nothing stored, and Pro users have an email address, a Google
account ID, and a list of signed-in devices held. It should state that no download
activity is recorded for anyone, that no IP addresses are stored, that Google
handles authentication and we never see a password, and how to delete an account
(which cascades sessions).

`terms` currently describes a one-time purchase with a 14-day refund. It needs
subscription terms: billing period, renewal, cancellation taking effect at period
end, and the refund policy for a recurring charge.

## Testing

The repo's Vitest config is node-only and covers pure modules. That boundary is
kept: logic worth testing is pure, and everything touching D1 is verified against a
real deployment by `scripts/cf-smoke.mjs`, matching the existing pattern.

**Unit** — `isProAt` across every status and both sides of every date boundary;
webhook signature verification including a tampered body and a wrong secret;
webhook replay rejection via `ls_updated_at`; access-token payload round-trip;
the five-session cap's "evict oldest" selection; the `redirect_to` origin check
against both a same-origin path and a hostile absolute URL; the first-login
preference merge, which must not overwrite server values that already exist; and
the reconcile staleness predicate, including that a fresh row never triggers a
fetch and that `?reconcile=1` bypasses the check.

**Smoke, against a preview deployment** — `/api/auth/google` 302s to
`accounts.google.com` and sets state and PKCE cookies; `/api/auth/refresh` with no
cookie returns 401 without a database read; `/api/billing/webhook` rejects an
unsigned body; `/api/download` still succeeds anonymously and is unaffected by a
malformed `X-Pro-Token`.

**Manual, once** — the full purchase path: sign in, subscribe, confirm Pro
activates within 15 minutes, cancel, confirm Pro persists to `ends_at`. Then the
repair path, which is the one no unit test can prove: disable the webhook endpoint
in Lemon Squeezy, change the subscription there, and confirm `/account` corrects
itself on the next refresh.
