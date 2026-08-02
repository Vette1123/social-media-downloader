# Accounts and Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the $9 one-time Lemon Squeezy license key with a $3/month or $24/year subscription behind a Google account, with D1-backed revocable sessions, without adding any work to the download path.

**Architecture:** Google OAuth via `arctic` (dynamically imported inside handlers, never at module scope). Sessions live in Cloudflare D1 behind an `httpOnly` cookie. Entitlement is carried to `/api/download` by the existing 15-minute HMAC token, so the hot path stays a single signature verify with no database read. Lemon Squeezy webhooks write subscription state; a lazy reconcile repairs rows webhooks lost.

**Tech Stack:** Next 15 static export, hand-written Cloudflare Worker, D1, `arctic`, Lemon Squeezy, Vitest (node environment, pure modules only).

**Spec:** `docs/superpowers/specs/2026-08-02-accounts-subscriptions-design.md` — read it before Task 1.

## Global Constraints

- **Package manager is pnpm.** Never npm or yarn. Delete any `package-lock.json` that appears.
- **Never deploy manually.** CI/CD deploys on push to `main`. Do not run `wrangler deploy` or `pnpm deploy`.
- **No commit trailers.** No `Co-Authored-By`, no AI attribution lines.
- **Commit subjects start with the type** (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`). No leading or trailing stray characters.
- **`/api/download` gains zero work.** No new import reachable from it, no D1, no extra parsing. Its CPU must match the pre-change baseline.
- **Auth and billing dependencies are `await import()`ed inside handler bodies**, never imported at module scope. A module-scope import is evaluated on every isolate's first request — including an anonymous download. This is the 129 ms Next trap.
- **No nested ternaries.** A ternary inside another ternary's branch is banned. Extract a named helper or use `switch`.
- **DRY.** Second occurrence of a pattern means extract it. One shared helper beats three call-site copies.
- **Tests are node-environment Vitest over pure modules only** (`src/**/*.test.ts`). No jsdom, no React plugin, no new test framework. Anything touching D1 or the network is verified by `scripts/cf-smoke.mjs` against a preview deploy.
- **Free-tier limits are the design target:** 10 ms CPU/request, 100k requests/day, 100k D1 rows written/day, 5M D1 rows read/day.
- **Every D1 lookup column is a primary key or indexed.** D1 bills rows *scanned*, so an unindexed `WHERE` bills the whole table.
- **Prices, verbatim:** `$3` monthly, `$24` annual. Five-device session cap. 15-minute access token. 90-day session. 14-day `past_due` grace.

---

## File Structure

**Created**

| File | Responsibility |
|------|----------------|
| `migrations/0001_accounts.sql` | The two tables and their indexes |
| `src/lib/billing/entitlement.ts` | `isProAt` — the only place that decides who is Pro |
| `src/lib/billing/webhook.ts` | Signature verification + the pure event→patch reducer |
| `src/lib/billing/reconcile.ts` | Staleness predicate + LS subscription re-sync |
| `src/lib/billing/portal.ts` | Fresh signed customer-portal URL |
| `src/lib/auth/session.ts` | D1 session CRUD, cookie helpers, eviction |
| `src/lib/auth/google.ts` | arctic wrapper, `safeRedirect` |
| `src/lib/auth/routes.ts` | The five handlers: google, callback, refresh, logout, account |
| `src/components/AccountControl.tsx` | Fixed top-right control, mounted once in layout |
| `src/components/AccountPanel.tsx` | Plan + Preferences + Account sections |
| `src/components/PastDueBanner.tsx` | The one interruption Pro users can see |
| `src/app/account/page.tsx` | The `/account` route |

**Modified**

| File | Change |
|------|--------|
| `src/lib/licenseToken.ts` → `src/lib/proToken.ts` | Renamed; payload `{k,exp}` → `{u,exp,p}`; TTL 24h → 15m; `hashKey` becomes `sha256Hex` |
| `src/lib/apiRoutes.ts` | Handler signature gains `env`; route table; `isPriorityRequest`; `handleLicense` deleted |
| `src/lib/entitlements.ts` | Rewritten around the session cookie |
| `src/lib/prefs.ts` | Gains server sync |
| `cloudflare/worker.js` | Passes `env` to handlers |
| `wrangler.jsonc` | `d1_databases` binding |
| `src/config/pro.ts` | Two checkout URLs |
| `src/app/pro/page.tsx` | Subscription copy |
| `src/app/page.tsx` | One hero chip reworded |
| `src/app/layout.tsx` | Mounts `AccountControl` |
| `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` | Data-controller and subscription terms |
| `scripts/cf-smoke.mjs` | License assertions → auth assertions |
| `.env.sample`, `.env.cloudflare.sample`, `README.md` | New secrets |

**Deleted**

`src/components/ProLicensePanel.tsx`, `src/app/api/license/route.ts`, `scripts/ls-finish.mjs`, `src/lib/licenseToken.test.ts` (moves to `proToken.test.ts`), `src/lib/entitlements.test.ts` (replaced).

---

## Task 1: D1 binding and the env-threading change

The handler signature today is `(request, ctx)`. D1 lives on the Worker's `env`, which handlers cannot currently see. This must land before anything that touches the database.

Under `next dev` there is no `env`, so D1-backed routes answer 503 — the same degradation `handleLicense` already uses when its secret is missing. Auth is developed against `pnpm preview` (wrangler dev), not `next dev`.

**Files:**
- Create: `migrations/0001_accounts.sql`
- Modify: `src/lib/apiRoutes.ts:28-31` (the `Handler` type), `cloudflare/worker.js:65-78`, `wrangler.jsonc`

**Interfaces:**
- Produces: `type WorkerEnv = { DB?: D1Database }`, exported from `src/lib/apiRoutes.ts`
- Produces: `type Handler = (request: Request, ctx?: WaitUntilContext, env?: WorkerEnv) => Promise<Response> | Response`

- [ ] **Step 1: Write the migration**

Create `migrations/0001_accounts.sql`:

```sql
-- Accounts and subscriptions. See
-- docs/superpowers/specs/2026-08-02-accounts-subscriptions-design.md
--
-- Every column used in a WHERE is a primary key, UNIQUE, or indexed: D1 bills
-- rows *scanned*, so an unindexed lookup bills the whole table per request.

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  google_sub          TEXT NOT NULL UNIQUE,
  email               TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  prefs               TEXT,

  ls_subscription_id  TEXT UNIQUE,
  ls_status           TEXT,
  ls_variant          TEXT,
  ls_renews_at        INTEGER,
  ls_ends_at          INTEGER,
  ls_past_due_since   INTEGER,
  ls_updated_at       INTEGER
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
```

- [ ] **Step 2: Create the database and apply the migration locally**

```bash
pnpm exec wrangler d1 create social-media-downloader
pnpm exec wrangler d1 execute social-media-downloader --local --file=migrations/0001_accounts.sql
```

Copy the `database_id` from the create output — it goes in `wrangler.jsonc` next.

- [ ] **Step 3: Add the binding to `wrangler.jsonc`**

Insert after the `"observability"` block, matching the file's existing comment style:

```jsonc
  // Accounts and subscription state. Only the auth and billing routes touch
  // this; /api/download never reads it, which is what keeps the resolve path
  // free of database latency. See the accounts design doc.
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "social-media-downloader",
      "database_id": "<paste the id from wrangler d1 create>"
    }
  ],
```

- [ ] **Step 4: Widen the handler signature**

In `src/lib/apiRoutes.ts`, replace the `Handler` type at lines 28-31:

```ts
/**
 * D1 and any other binding live on the Worker's `env`, which is only available
 * to the Cloudflare entrypoint. The Next App Router wrappers under src/app/api
 * call these same functions with no `env`, so a handler that needs a binding
 * must degrade rather than throw — see `requireDb`.
 */
export interface WorkerEnv {
  DB?: D1Database
}

type Handler = (
  request: Request,
  ctx?: WaitUntilContext,
  env?: WorkerEnv,
) => Promise<Response> | Response

/**
 * The 503 a binding-backed route answers when it is running somewhere without
 * that binding — `next dev`, or a misconfigured deployment. Mirrors the shape
 * `nativeMediaUnavailable` uses for the same class of "not available here".
 */
export function requireDb(env?: WorkerEnv): D1Database | Response {
  if (!env?.DB) {
    return Response.json(
      { success: false, error: 'Accounts are not configured on this deployment.' },
      { status: 503 },
    )
  }
  return env.DB
}
```

- [ ] **Step 5: Pass `env` from the Worker entrypoint**

In `cloudflare/worker.js`, change the dispatch line (currently `return route.handler(request, ctx)`):

```js
      // `env` carries the D1 binding. Handlers that do not need it ignore the
      // extra argument, exactly as they already do with `ctx`.
      return route.handler(request, ctx, env)
```

- [ ] **Step 6: Regenerate Cloudflare types and verify the build**

```bash
pnpm cf-typegen
pnpm lint && pnpm test && pnpm cf:build
```

Expected: all pass. `D1Database` resolves from the generated types.

- [ ] **Step 7: Commit**

```bash
git add migrations wrangler.jsonc cloudflare/worker.js src/lib/apiRoutes.ts cloudflare-env.d.ts
git commit -m "feat(d1): add the accounts schema and thread env to handlers"
```

---

## Task 2: `isProAt`, the entitlement rule

The single place that decides who is Pro. Pure, no I/O, exhaustively tested — a mistake here either gives away paid service or takes it from someone who paid.

**Files:**
- Create: `src/lib/billing/entitlement.ts`, `src/lib/billing/entitlement.test.ts`

**Interfaces:**
- Produces: `PAST_DUE_GRACE_MS`, `interface BillingRow`, `isProAt(row: BillingRow | null, now: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/billing/entitlement.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isProAt, PAST_DUE_GRACE_MS, type BillingRow } from './entitlement'

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

function row(overrides: Partial<BillingRow> = {}): BillingRow {
  return {
    ls_status: 'active',
    ls_ends_at: null,
    ls_past_due_since: null,
    ...overrides,
  }
}

describe('isProAt', () => {
  it('is false with no row at all', () => {
    expect(isProAt(null, NOW)).toBe(false)
  })

  it('is false for a user who never subscribed', () => {
    expect(isProAt(row({ ls_status: null }), NOW)).toBe(false)
  })

  it('is true while active', () => {
    expect(isProAt(row({ ls_status: 'active' }), NOW)).toBe(true)
  })

  it('is true during a trial', () => {
    expect(isProAt(row({ ls_status: 'on_trial' }), NOW)).toBe(true)
  })

  it('is true after cancelling, up to the paid-through date', () => {
    const r = row({ ls_status: 'cancelled', ls_ends_at: NOW + DAY })
    expect(isProAt(r, NOW)).toBe(true)
  })

  it('is false once the cancelled period has elapsed', () => {
    const r = row({ ls_status: 'cancelled', ls_ends_at: NOW })
    expect(isProAt(r, NOW)).toBe(false)
  })

  it('is false when cancelled with no end date recorded', () => {
    expect(isProAt(row({ ls_status: 'cancelled', ls_ends_at: null }), NOW)).toBe(false)
  })

  it('keeps Pro on day 13 of the past_due grace', () => {
    const r = row({ ls_status: 'past_due', ls_past_due_since: NOW - 13 * DAY })
    expect(isProAt(r, NOW)).toBe(true)
  })

  it('drops Pro exactly at the end of the past_due grace', () => {
    const r = row({ ls_status: 'past_due', ls_past_due_since: NOW - PAST_DUE_GRACE_MS })
    expect(isProAt(r, NOW)).toBe(false)
  })

  it('drops Pro past the grace window', () => {
    const r = row({ ls_status: 'past_due', ls_past_due_since: NOW - 15 * DAY })
    expect(isProAt(r, NOW)).toBe(false)
  })

  it('is false for past_due with no start recorded, rather than granting forever', () => {
    expect(isProAt(row({ ls_status: 'past_due', ls_past_due_since: null }), NOW)).toBe(false)
  })

  it.each(['paused', 'unpaid', 'expired'])('is false when %s', (status) => {
    expect(isProAt(row({ ls_status: status }), NOW)).toBe(false)
  })

  it('is false for a status Lemon Squeezy has not documented yet', () => {
    expect(isProAt(row({ ls_status: 'something_new' }), NOW)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm test src/lib/billing/entitlement.test.ts
```

Expected: FAIL — cannot resolve `./entitlement`.

- [ ] **Step 3: Implement**

Create `src/lib/billing/entitlement.ts`:

```ts
/**
 * Who is Pro, and until when. The only place in the codebase that decides.
 *
 * Kept pure and dependency-free so it can be exhaustively unit-tested: a bug
 * here either hands out paid features or takes them from someone who paid, and
 * neither shows up in a smoke test.
 */

/**
 * How long a failed payment keeps Pro alive.
 *
 * Lemon Squeezy retries four times over two weeks before flipping a
 * subscription to `unpaid`, and most of those retries succeed — an expired card
 * is the largest single cause of involuntary churn and is not a decision to
 * leave. The cap is ours rather than theirs so that a changed retry schedule, a
 * wedged subscription, or a webhook that never lands cannot mean unbounded free
 * service. In normal operation Lemon Squeezy resolves the subscription first and
 * this never fires.
 */
export const PAST_DUE_GRACE_MS = 14 * 24 * 60 * 60 * 1000

/** The subset of the `users` row that entitlement depends on. */
export interface BillingRow {
  ls_status: string | null
  ls_ends_at: number | null
  ls_past_due_since: number | null
}

/**
 * A `switch` rather than chained ternaries, and an explicit `default: false`,
 * so a status Lemon Squeezy adds later fails closed instead of matching some
 * broader condition by accident.
 */
export function isProAt(row: BillingRow | null, now: number): boolean {
  if (!row?.ls_status) return false

  switch (row.ls_status) {
    case 'active':
    case 'on_trial':
      return true

    // "Cancelled" in Lemon Squeezy means *will not renew*, not *stopped now*.
    // The customer has already paid through the end of the period.
    case 'cancelled':
      return row.ls_ends_at !== null && now < row.ls_ends_at

    // A null start means we never observed the transition, so there is no
    // window to measure. Fail closed rather than grant an unbounded grace.
    case 'past_due':
      return (
        row.ls_past_due_since !== null &&
        now < row.ls_past_due_since + PAST_DUE_GRACE_MS
      )

    default:
      return false
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm test src/lib/billing/entitlement.test.ts
```

Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/entitlement.ts src/lib/billing/entitlement.test.ts
git commit -m "feat(billing): add isProAt, the single entitlement rule"
```

---

## Task 3: Retarget the signed token from licenses to users

Rename the module, swap the payload, shorten the TTL. `signToken`/`verifyToken` themselves are already correct and stay byte-for-byte — this is a rename plus a payload change, not a rewrite.

**Files:**
- Rename: `src/lib/licenseToken.ts` → `src/lib/proToken.ts`, `src/lib/licenseToken.test.ts` → `src/lib/proToken.test.ts`
- Modify: `src/lib/apiRoutes.ts` (import + `isPriorityRequest`)

**Interfaces:**
- Consumes: nothing
- Produces: `ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000`, `interface TokenPayload { u: string; exp: number; p: boolean }`, `signToken(payload, secret)`, `verifyToken(token, secret, now): Promise<TokenPayload | null>`, `sha256Hex(value: string): Promise<string>`

- [ ] **Step 1: Rename both files with git**

```bash
git mv src/lib/licenseToken.ts src/lib/proToken.ts
git mv src/lib/licenseToken.test.ts src/lib/proToken.test.ts
```

- [ ] **Step 2: Update the test for the new payload**

In `src/lib/proToken.test.ts`, change the import to `./proToken`, replace every `TOKEN_TTL_MS` with `ACCESS_TOKEN_TTL_MS`, replace every payload literal `{ k: '...', exp }` with `{ u: 'user-1', exp, p: true }`, and append:

```ts
describe('the pro flag', () => {
  it('round-trips a Pro user', async () => {
    const exp = NOW + 60_000
    const token = await signToken({ u: 'user-1', exp, p: true }, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toEqual({ u: 'user-1', exp, p: true })
  })

  it('round-trips a signed-in free user', async () => {
    const exp = NOW + 60_000
    const token = await signToken({ u: 'user-1', exp, p: false }, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toEqual({ u: 'user-1', exp, p: false })
  })

  it('rejects a payload missing the pro flag', async () => {
    const exp = NOW + 60_000
    const token = await signToken({ u: 'user-1', exp } as never, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toBeNull()
  })

  it('rejects a payload with no user id', async () => {
    const exp = NOW + 60_000
    const token = await signToken({ exp, p: true } as never, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toBeNull()
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

```bash
pnpm test src/lib/proToken.test.ts
```

Expected: FAIL — `ACCESS_TOKEN_TTL_MS` is not exported and the payload shape check rejects `u`.

- [ ] **Step 4: Update the module**

In `src/lib/proToken.ts`:

Replace the `TokenPayload` interface and TTL constant:

```ts
export interface TokenPayload {
  /** The user's id. Opaque to the client; only ever compared, never displayed. */
  u: string
  /** Absolute expiry, epoch milliseconds. */
  exp: number
  /**
   * Whether this user is Pro. Carrying the entitlement in the token is what
   * lets /api/download answer without a database read — the cost is that a
   * change in entitlement takes up to one TTL to be felt.
   */
  p: boolean
}

/**
 * Fifteen minutes. Short enough that revoking a session or losing a
 * subscription is felt almost immediately, long enough that an active user
 * refreshes at most four times an hour.
 */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
```

Update the header comment's first line to "A minimal signed token, used so that a Pro request can be trusted by the Worker without a database read on every resolve."

In `verifyToken`, replace the payload shape check:

```ts
    if (
      typeof payload?.u !== 'string' ||
      typeof payload?.exp !== 'number' ||
      typeof payload?.p !== 'boolean'
    ) {
      return null
    }
```

Replace `TOKEN_TTL_MS` with `ACCESS_TOKEN_TTL_MS` in the max-expiry guard.

Replace `hashKey` with a hex variant, which the session store needs:

```ts
/**
 * SHA-256, hex-encoded. Used to hash session cookie values before they are
 * stored, so a leaked database read does not hand anyone a working session.
 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

- [ ] **Step 5: Point `apiRoutes.ts` at the new module**

Change the import on line 26 to:

```ts
import { verifyToken } from './proToken'
```

(`hashKey`, `signToken`, and `TOKEN_TTL_MS` are no longer used there — `handleLicense` goes away in Task 12. If it still references them at this point, leave it compiling by keeping the named imports it needs and removing them in Task 12.)

Update `isPriorityRequest` to require the Pro flag:

```ts
/**
 * A Pro token unlocks resolver ordering and (via `authenticated`) sending the
 * operator's Instagram session cookie — never anything that can error. An
 * absent, malformed, or expired token degrades silently to the normal free
 * path rather than erroring.
 *
 * A signed-in free user carries a valid token with `p: false`, which is not a
 * priority request. The flag is checked, not merely the signature.
 */
async function isPriorityRequest(request: Request): Promise<boolean> {
  const token = request.headers.get('X-Pro-Token')
  const secret = process.env.PRO_TOKEN_SECRET?.trim()
  if (!token || !secret) return false
  const payload = await verifyToken(token, secret, Date.now())
  return payload?.p === true
}
```

- [ ] **Step 6: Run the full suite**

```bash
pnpm test && pnpm lint
```

Expected: PASS. If `apiRoutes.ts` still imports removed names, fix the imports now.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib
git commit -m "refactor(token): retarget the signed token from licenses to users"
```

---

## Task 4: Session store

D1 session CRUD plus the pure helpers worth testing on their own.

**Files:**
- Create: `src/lib/auth/session.ts`, `src/lib/auth/session.test.ts`

**Interfaces:**
- Consumes: `sha256Hex` from `src/lib/proToken.ts`
- Produces:
  - `SESSION_COOKIE = 'smd_session'`, `HINT_COOKIE = 'smd_account'`, `SESSION_TTL_MS`, `MAX_SESSIONS = 5`
  - `sessionsToEvict(existing: { id: string }[], max?: number): string[]`
  - `readCookie(header: string | null, name: string): string | null`
  - `sessionCookieHeaders(value: string, maxAgeSeconds: number): string[]`
  - `clearCookieHeaders(): string[]`
  - `createSession(db, userId, now): Promise<string>` — returns the raw cookie value
  - `loadSession(db, rawCookie, now): Promise<UserRow | null>`
  - `deleteSession(db, rawCookie): Promise<void>`
  - `deleteAllSessions(db, userId): Promise<void>`
  - `interface UserRow` — the full users row, including the `BillingRow` fields

- [ ] **Step 1: Write the failing test for the pure helpers**

Create `src/lib/auth/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  MAX_SESSIONS,
  clearCookieHeaders,
  readCookie,
  sessionCookieHeaders,
  sessionsToEvict,
} from './session'

describe('sessionsToEvict', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }))

  it('evicts nothing when there is room for one more', () => {
    expect(sessionsToEvict(rows(MAX_SESSIONS - 1))).toEqual([])
  })

  it('evicts the oldest when the cap is already reached', () => {
    expect(sessionsToEvict(rows(MAX_SESSIONS))).toEqual(['s0'])
  })

  it('evicts enough to leave room after a backlog', () => {
    expect(sessionsToEvict(rows(MAX_SESSIONS + 2))).toEqual(['s0', 's1', 's2'])
  })

  it('evicts nothing for a first-time user', () => {
    expect(sessionsToEvict([])).toEqual([])
  })
})

describe('readCookie', () => {
  it('returns null with no cookie header at all', () => {
    expect(readCookie(null, 'smd_session')).toBeNull()
  })

  it('reads a lone cookie', () => {
    expect(readCookie('smd_session=abc', 'smd_session')).toBe('abc')
  })

  it('reads a cookie from the middle of a list', () => {
    expect(readCookie('a=1; smd_session=abc; b=2', 'smd_session')).toBe('abc')
  })

  it('does not match a name that merely ends with the target', () => {
    expect(readCookie('not_smd_session=abc', 'smd_session')).toBeNull()
  })

  it('returns null for a name that is absent', () => {
    expect(readCookie('a=1; b=2', 'smd_session')).toBeNull()
  })
})

describe('cookie headers', () => {
  it('marks the session cookie httpOnly and same-site', () => {
    const [session] = sessionCookieHeaders('abc', 60)
    expect(session).toContain('smd_session=abc')
    expect(session).toContain('HttpOnly')
    expect(session).toContain('Secure')
    expect(session).toContain('SameSite=Lax')
    expect(session).toContain('Max-Age=60')
  })

  it('leaves the hint cookie readable by scripts', () => {
    const [, hint] = sessionCookieHeaders('abc', 60)
    expect(hint).toContain('smd_account=1')
    expect(hint).not.toContain('HttpOnly')
  })

  it('expires both cookies on clear', () => {
    const headers = clearCookieHeaders()
    expect(headers).toHaveLength(2)
    for (const header of headers) expect(header).toContain('Max-Age=0')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm test src/lib/auth/session.test.ts
```

Expected: FAIL — cannot resolve `./session`.

- [ ] **Step 3: Implement**

Create `src/lib/auth/session.ts`:

```ts
/**
 * Sessions: the long-lived half of authentication.
 *
 * A session is a random 256-bit value handed to the browser in an httpOnly
 * cookie. Only its SHA-256 lands in D1, so a leaked database read does not hand
 * anyone a working session. Revocation is a hard DELETE — a `revoked_at` flag
 * would put a `WHERE revoked_at IS NULL` on every query in exchange for history
 * nobody reads.
 *
 * This module is the only thing that talks to the `sessions` table.
 */

import { sha256Hex } from '../proToken'
import type { BillingRow } from '../billing/entitlement'

export const SESSION_COOKIE = 'smd_session'

/**
 * A second, deliberately script-readable cookie carrying no user data.
 *
 * The header control needs to know whether to render "Sign in" or an avatar,
 * and it renders on every page. Asking an endpoint would put every page view
 * back on the Worker and spend the 100k/day request budget drawing an avatar,
 * so the answer is a cookie the client can read with no network call.
 *
 * It is a hint, never a credential: every real decision still requires the
 * httpOnly session cookie, checked server-side. Forging it buys an avatar that
 * links to a page telling you to sign in.
 */
export const HINT_COOKIE = 'smd_account'

export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000

/**
 * Five concurrent sessions per account. The successor to the license key's five
 * activation slots, and the only thing bounding how far one account can be
 * shared — a sixth sign-in evicts the oldest.
 */
export const MAX_SESSIONS = 5

/** The `users` row, as every caller here needs it. */
export interface UserRow extends BillingRow {
  id: string
  google_sub: string
  email: string
  created_at: number
  prefs: string | null
  ls_subscription_id: string | null
  ls_variant: string | null
  ls_renews_at: number | null
  ls_updated_at: number | null
}

/**
 * Which sessions must go so that inserting one more stays within the cap.
 * Callers pass rows already ordered oldest-first.
 */
export function sessionsToEvict(
  existing: { id: string }[],
  max: number = MAX_SESSIONS,
): string[] {
  const surplus = existing.length - max + 1
  if (surplus <= 0) return []
  return existing.slice(0, surplus).map((row) => row.id)
}

/**
 * Split on `;` and compare the name exactly, rather than a substring or regex
 * match — `not_smd_session=x` must not read as `smd_session`.
 */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== name) continue
    return part.slice(separator + 1).trim()
  }
  return null
}

export function sessionCookieHeaders(value: string, maxAgeSeconds: number): string[] {
  const shared = `Path=/; Max-Age=${maxAgeSeconds}; Secure; SameSite=Lax`
  return [
    `${SESSION_COOKIE}=${value}; ${shared}; HttpOnly`,
    `${HINT_COOKIE}=1; ${shared}`,
  ]
}

export function clearCookieHeaders(): string[] {
  return sessionCookieHeaders('', 0).map((header) =>
    header.replace(`${HINT_COOKIE}=1`, `${HINT_COOKIE}=`),
  )
}

const USER_COLUMNS =
  'id, google_sub, email, created_at, prefs, ls_subscription_id, ls_status, ' +
  'ls_variant, ls_renews_at, ls_ends_at, ls_past_due_since, ls_updated_at'

/**
 * Mint a session, evicting the oldest if the user is already at the cap.
 * Returns the raw cookie value; only its hash is stored.
 */
export async function createSession(
  db: D1Database,
  userId: string,
  now: number,
): Promise<string> {
  const existing = await db
    .prepare('SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at ASC')
    .bind(userId)
    .all<{ id: string }>()

  const evict = sessionsToEvict(existing.results ?? [])
  if (evict.length > 0) {
    const placeholders = evict.map(() => '?').join(', ')
    await db
      .prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`)
      .bind(...evict)
      .run()
  }

  const raw = crypto.randomUUID() + crypto.randomUUID()
  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
    .bind(await sha256Hex(raw), userId, now, now + SESSION_TTL_MS)
    .run()

  return raw
}

/**
 * One indexed join, so D1 scans two rows rather than a table. An expired
 * session reads as absent; the row is left for the next write to clean up
 * rather than spending a write on every read.
 */
export async function loadSession(
  db: D1Database,
  rawCookie: string | null,
  now: number,
): Promise<UserRow | null> {
  if (!rawCookie) return null
  const row = await db
    .prepare(
      `SELECT ${USER_COLUMNS} FROM users
       JOIN sessions ON sessions.user_id = users.id
       WHERE sessions.id = ? AND sessions.expires_at > ?`,
    )
    .bind(await sha256Hex(rawCookie), now)
    .first<UserRow>()
  return row ?? null
}

export async function deleteSession(db: D1Database, rawCookie: string | null): Promise<void> {
  if (!rawCookie) return
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(rawCookie)).run()
}

export async function deleteAllSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm test src/lib/auth/session.test.ts && pnpm lint
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts
git commit -m "feat(auth): add the D1 session store"
```

---

## Task 5: Google OAuth helpers

`arctic` is added here but must never be imported at module scope — see Global Constraints.

**Files:**
- Create: `src/lib/auth/google.ts`, `src/lib/auth/google.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `safeRedirect(target: string | null, origin: string): string`, `googleClient(origin: string): Promise<Google>`, `OAUTH_STATE_COOKIE`, `OAUTH_VERIFIER_COOKIE`, `oauthTempCookie(name, value)`

- [ ] **Step 1: Install arctic**

```bash
pnpm add arctic
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/auth/google.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { safeRedirect } from './google'

const ORIGIN = 'https://example.com'

describe('safeRedirect', () => {
  it('defaults to the home page when nothing was requested', () => {
    expect(safeRedirect(null, ORIGIN)).toBe('/')
  })

  it('keeps a same-origin path', () => {
    expect(safeRedirect('/tiktok-downloader', ORIGIN)).toBe('/tiktok-downloader')
  })

  it('keeps a query string', () => {
    expect(safeRedirect('/account?checkout=success', ORIGIN)).toBe('/account?checkout=success')
  })

  it('accepts an absolute URL on our own origin, reduced to a path', () => {
    expect(safeRedirect(`${ORIGIN}/pro`, ORIGIN)).toBe('/pro')
  })

  it('rejects another origin', () => {
    expect(safeRedirect('https://evil.example/phish', ORIGIN)).toBe('/')
  })

  it('rejects a protocol-relative URL, which resolves off-origin', () => {
    expect(safeRedirect('//evil.example/phish', ORIGIN)).toBe('/')
  })

  it('rejects a javascript: URL', () => {
    expect(safeRedirect('javascript:alert(1)', ORIGIN)).toBe('/')
  })

  it('rejects a malformed target rather than throwing', () => {
    expect(safeRedirect('http://[', ORIGIN)).toBe('/')
  })

  it('drops any fragment', () => {
    expect(safeRedirect('/pro#pricing', ORIGIN)).toBe('/pro')
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

```bash
pnpm test src/lib/auth/google.test.ts
```

Expected: FAIL — cannot resolve `./google`.

- [ ] **Step 4: Implement**

Create `src/lib/auth/google.ts`:

```ts
/**
 * The Google half of sign-in.
 *
 * `arctic` is loaded with a dynamic import inside `googleClient`, never at
 * module scope. Module-scope initialisation is billed to the first request that
 * loads the module in every isolate — the same mechanism that made Next's lazy
 * init cost 129 ms here — and `apiRoutes.ts` imports one shared route table, so
 * a top-level import would put the OAuth client on the critical path of an
 * anonymous /api/download.
 */

import type { Google } from 'arctic'

/** Short-lived, single-use, and gone by the time the callback returns. */
export const OAUTH_STATE_COOKIE = 'smd_oauth_state'
export const OAUTH_VERIFIER_COOKIE = 'smd_oauth_verifier'

const OAUTH_TEMP_TTL_SECONDS = 10 * 60

export function oauthTempCookie(name: string, value: string): string {
  const age = value === '' ? 0 : OAUTH_TEMP_TTL_SECONDS
  return `${name}=${value}; Path=/; Max-Age=${age}; Secure; SameSite=Lax; HttpOnly`
}

export async function googleClient(origin: string): Promise<Google> {
  const { Google } = await import('arctic')
  return new Google(
    process.env.GOOGLE_CLIENT_ID ?? '',
    process.env.GOOGLE_CLIENT_SECRET ?? '',
    `${origin}/api/auth/callback`,
  )
}

/**
 * Where to send someone after signing in.
 *
 * An unvalidated redirect parameter on an auth endpoint is a textbook open
 * redirect, and phishing through the sign-in flow is more damaging than
 * anywhere else on the site: the victim has just been asked for credentials, so
 * a hostile landing page is maximally believable. Anything not provably on our
 * own origin becomes "/".
 *
 * Resolving against `origin` is what catches the awkward cases — a
 * protocol-relative `//evil.example` parses as another origin rather than a
 * path, and `javascript:` never matches.
 */
export function safeRedirect(target: string | null, origin: string): string {
  if (!target) return '/'
  try {
    const url = new URL(target, origin)
    if (url.origin !== origin) return '/'
    return `${url.pathname}${url.search}`
  } catch {
    return '/'
  }
}
```

- [ ] **Step 5: Run the tests**

```bash
pnpm test src/lib/auth/google.test.ts && pnpm lint
```

Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/auth/google.ts src/lib/auth/google.test.ts
git commit -m "feat(auth): add the Google OAuth client and redirect validation"
```

---

## Task 6: Auth endpoints

**Files:**
- Create: `src/lib/auth/routes.ts`
- Modify: `src/lib/apiRoutes.ts` (route table)

**Interfaces:**
- Consumes: everything from Tasks 2, 3, 4, 5
- Produces: `handleAuthStart`, `handleAuthCallback`, `handleRefresh`, `handleLogout`, `handleAccount` — all `Handler`-shaped

- [ ] **Step 1: Implement the handlers**

Create `src/lib/auth/routes.ts`:

```ts
/**
 * The auth surface: five handlers, all shaped like every other route in
 * API_ROUTES so the Worker can dispatch them without initialising Next.
 *
 * `arctic` and the reconcile path are dynamically imported inside the handlers
 * that need them. An isolate that only ever serves downloads must never load
 * either — see src/lib/auth/google.ts for why.
 */

import { requireDb, type WorkerEnv } from '../apiRoutes'
import type { WaitUntilContext } from '../edgeCache'
import { ACCESS_TOKEN_TTL_MS, signToken } from '../proToken'
import { isProAt } from '../billing/entitlement'
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  googleClient,
  oauthTempCookie,
  safeRedirect,
} from './google'
import {
  HINT_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  clearCookieHeaders,
  createSession,
  deleteAllSessions,
  deleteSession,
  loadSession,
  readCookie,
  sessionCookieHeaders,
} from './session'

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

/** GET /api/auth/google */
export async function handleAuthStart(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    return Response.json(
      { success: false, error: 'Sign-in is not configured on this deployment.' },
      { status: 503 },
    )
  }

  const arctic = await import('arctic')
  const state = arctic.generateState()
  const verifier = arctic.generateCodeVerifier()
  const google = await googleClient(url.origin)

  // openid + email only. We need an identifier and an address to match an
  // orphaned webhook against; a profile scope would collect a name and photo
  // this design has nowhere to put.
  const authorizationUrl = google.createAuthorizationURL(state, verifier, ['openid', 'email'])

  // The post-login destination rides in the state cookie's sibling rather than
  // through Google, so it cannot be tampered with in transit.
  const target = safeRedirect(url.searchParams.get('redirect_to'), url.origin)

  return redirect(authorizationUrl.toString(), [
    oauthTempCookie(OAUTH_STATE_COOKIE, `${state}.${encodeURIComponent(target)}`),
    oauthTempCookie(OAUTH_VERIFIER_COOKIE, verifier),
  ])
}

/** GET /api/auth/callback */
export async function handleAuthCallback(
  request: Request,
  _ctx?: WaitUntilContext,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const url = new URL(request.url)
  const cookies = request.headers.get('Cookie')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = readCookie(cookies, OAUTH_STATE_COOKIE)
  const verifier = readCookie(cookies, OAUTH_VERIFIER_COOKIE)

  const [expectedState, encodedTarget = '%2F'] = (storedState ?? '').split('.')
  if (!code || !state || !verifier || !expectedState || state !== expectedState) {
    return Response.json(
      { success: false, error: 'Sign-in could not be completed. Please try again.' },
      { status: 400 },
    )
  }

  const google = await googleClient(url.origin)
  const arctic = await import('arctic')

  let claims: { sub?: string; email?: string }
  try {
    const tokens = await google.validateAuthorizationCode(code, verifier)
    // Decoded, not signature-verified, and that is correct here: the token
    // arrived over TLS as the direct response to a server-side request
    // authenticated with our client secret. There is no untrusted path it could
    // have travelled.
    claims = arctic.decodeIdToken(tokens.idToken()) as { sub?: string; email?: string }
  } catch {
    return Response.json(
      { success: false, error: 'Sign-in could not be completed. Please try again.' },
      { status: 400 },
    )
  }

  if (!claims.sub || !claims.email) {
    return Response.json(
      { success: false, error: 'Google did not return an email address.' },
      { status: 400 },
    )
  }

  const now = Date.now()
  // ON CONFLICT keeps the email current for someone who changed it at Google,
  // without disturbing their billing columns.
  await db
    .prepare(
      `INSERT INTO users (id, google_sub, email, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email`,
    )
    .bind(crypto.randomUUID(), claims.sub, claims.email, now)
    .run()

  const user = await db
    .prepare('SELECT id FROM users WHERE google_sub = ?')
    .bind(claims.sub)
    .first<{ id: string }>()

  if (!user) {
    return Response.json(
      { success: false, error: 'Could not create your account. Please try again.' },
      { status: 500 },
    )
  }

  const raw = await createSession(db, user.id, now)
  const target = safeRedirect(decodeURIComponent(encodedTarget), url.origin)

  return redirect(`${url.origin}${target}`, [
    ...sessionCookieHeaders(raw, Math.floor(SESSION_TTL_MS / 1000)),
    oauthTempCookie(OAUTH_STATE_COOKIE, ''),
    oauthTempCookie(OAUTH_VERIFIER_COOKIE, ''),
  ])
}

/** POST /api/auth/refresh */
export async function handleRefresh(
  request: Request,
  ctx?: WaitUntilContext,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const secret = process.env.PRO_TOKEN_SECRET?.trim()
  if (!secret) {
    return Response.json(
      { success: false, error: 'Sign-in is not configured on this deployment.' },
      { status: 503 },
    )
  }

  const now = Date.now()
  const raw = readCookie(request.headers.get('Cookie'), SESSION_COOKIE)
  const user = await loadSession(db, raw, now)

  if (!user) {
    // Clear the hint too, so a client holding a stale hint stops rendering an
    // avatar for a session that no longer exists.
    const headers = new Headers({ 'Content-Type': 'application/json' })
    for (const cookie of clearCookieHeaders()) headers.append('Set-Cookie', cookie)
    return new Response(JSON.stringify({ success: false, error: 'Not signed in' }), {
      status: 401,
      headers,
    })
  }

  // Repair a row webhooks lost. Deferred past the response, so the user waits
  // for nothing, and skipped entirely when the row is fresh — which, when
  // webhooks are working, is always.
  const forced = new URL(request.url).searchParams.get('reconcile') === '1'
  const { needsReconcile, reconcileSubscription } = await import('../billing/reconcile')
  if (needsReconcile(user, now, forced)) {
    const work = reconcileSubscription(db, user.ls_subscription_id as string, now)
    if (ctx) ctx.waitUntil(work)
    else await work
  }

  const pro = isProAt(user, now)
  const exp = now + ACCESS_TOKEN_TTL_MS
  const token = await signToken({ u: user.id, exp, p: pro }, secret)

  return Response.json({
    success: true,
    token,
    expiresAt: exp,
    pro,
    email: user.email,
    plan: {
      status: user.ls_status,
      variant: user.ls_variant,
      renewsAt: user.ls_renews_at,
      endsAt: user.ls_ends_at,
      pastDueSince: user.ls_past_due_since,
    },
    prefs: user.prefs,
  })
}

/** POST /api/auth/logout */
export async function handleLogout(
  request: Request,
  _ctx?: WaitUntilContext,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const raw = readCookie(request.headers.get('Cookie'), SESSION_COOKIE)
  const all = new URL(request.url).searchParams.get('all') === '1'

  if (all) {
    const user = await loadSession(db, raw, Date.now())
    if (user) await deleteAllSessions(db, user.id)
  } else {
    await deleteSession(db, raw)
  }

  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const cookie of clearCookieHeaders()) headers.append('Set-Cookie', cookie)
  return new Response(JSON.stringify({ success: true }), { status: 200, headers })
}

/** POST /api/account — { prefs } to save, { delete: true } to close the account. */
export async function handleAccount(
  request: Request,
  _ctx?: WaitUntilContext,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const user = await loadSession(
    db,
    readCookie(request.headers.get('Cookie'), SESSION_COOKIE),
    Date.now(),
  )
  if (!user) {
    return Response.json({ success: false, error: 'Not signed in' }, { status: 401 })
  }

  let body: { prefs?: unknown; delete?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (body.delete === true) {
    // Sessions cascade. This does not cancel a live subscription — the UI warns
    // and links to the billing portal before offering this.
    await db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run()
    const headers = new Headers({ 'Content-Type': 'application/json' })
    for (const cookie of clearCookieHeaders()) headers.append('Set-Cookie', cookie)
    return new Response(JSON.stringify({ success: true }), { status: 200, headers })
  }

  const { normalisePrefs } = await import('../prefs')
  const prefs = normalisePrefs(body.prefs)
  if (!prefs) {
    return Response.json({ success: false, error: 'Invalid preferences' }, { status: 400 })
  }

  await db
    .prepare('UPDATE users SET prefs = ? WHERE id = ?')
    .bind(JSON.stringify(prefs), user.id)
    .run()

  return Response.json({ success: true, prefs })
}
```

- [ ] **Step 2: Register the routes**

In `src/lib/apiRoutes.ts`, add the import and the table entries:

```ts
import {
  handleAccount,
  handleAuthCallback,
  handleAuthStart,
  handleLogout,
  handleRefresh,
} from './auth/routes'
```

```ts
  '/api/auth/google': { method: 'GET', handler: handleAuthStart },
  '/api/auth/callback': { method: 'GET', handler: handleAuthCallback },
  '/api/auth/refresh': { method: 'POST', handler: handleRefresh },
  '/api/auth/logout': { method: 'POST', handler: handleLogout },
  '/api/account': { method: 'POST', handler: handleAccount },
```

- [ ] **Step 3: Verify the build and lint**

```bash
pnpm lint && pnpm test && pnpm cf:build
```

Expected: PASS. Task 7 supplies `reconcile.ts` and Task 9 supplies `normalisePrefs`; if the build fails on those imports, complete Tasks 7 and 9 before re-running, or stub them locally and remove the stubs there.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/routes.ts src/lib/apiRoutes.ts
git commit -m "feat(auth): add sign-in, callback, refresh, logout, and account routes"
```

---

## Task 7: Lemon Squeezy webhook, portal, and reconcile

**Files:**
- Create: `src/lib/billing/webhook.ts`, `src/lib/billing/webhook.test.ts`, `src/lib/billing/reconcile.ts`, `src/lib/billing/reconcile.test.ts`, `src/lib/billing/portal.ts`
- Modify: `src/lib/apiRoutes.ts` (route table)

**Interfaces:**
- Produces: `verifyWebhookSignature(raw, signature, secret)`, `patchFromSubscription(attributes, customData, currentUpdatedAt, now)`, `handleWebhook`, `handlePortal`, `needsReconcile(row, now, forced)`, `RECONCILE_STALE_MS`, `reconcileSubscription(db, subscriptionId, now)`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/billing/webhook.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { patchFromSubscription, verifyWebhookSignature } from './webhook'

const SECRET = 'test-signing-secret'
const NOW = 1_800_000_000_000

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed body', async () => {
    const body = '{"ok":true}'
    expect(await verifyWebhookSignature(body, await sign(body, SECRET), SECRET)).toBe(true)
  })

  it('rejects a tampered body', async () => {
    const signature = await sign('{"ok":true}', SECRET)
    expect(await verifyWebhookSignature('{"ok":false}', signature, SECRET)).toBe(false)
  })

  it('rejects a signature made with a different secret', async () => {
    const body = '{"ok":true}'
    expect(await verifyWebhookSignature(body, await sign(body, 'wrong'), SECRET)).toBe(false)
  })

  it('rejects a missing signature', async () => {
    expect(await verifyWebhookSignature('{}', null, SECRET)).toBe(false)
  })

  it('rejects a non-hex signature rather than throwing', async () => {
    expect(await verifyWebhookSignature('{}', 'not-hex!!', SECRET)).toBe(false)
  })
})

describe('patchFromSubscription', () => {
  const attributes = {
    status: 'active',
    variant_name: 'Monthly',
    renews_at: '2026-09-02T00:00:00.000000Z',
    ends_at: null,
    updated_at: '2026-08-02T00:00:00.000000Z',
  }

  it('maps an active subscription', () => {
    const patch = patchFromSubscription('sub_1', attributes, { user_id: 'u1' }, null, NOW)
    expect(patch).toMatchObject({
      userId: 'u1',
      ls_subscription_id: 'sub_1',
      ls_status: 'active',
      ls_variant: 'monthly',
      ls_past_due_since: null,
    })
    expect(patch?.ls_renews_at).toBe(Date.parse(attributes.renews_at))
  })

  it('recognises the annual variant', () => {
    const patch = patchFromSubscription(
      'sub_1',
      { ...attributes, variant_name: 'Annual' },
      { user_id: 'u1' },
      null,
      NOW,
    )
    expect(patch?.ls_variant).toBe('annual')
  })

  it('stamps past_due_since the first time past_due is seen', () => {
    const patch = patchFromSubscription(
      'sub_1',
      { ...attributes, status: 'past_due' },
      { user_id: 'u1' },
      null,
      NOW,
    )
    expect(patch?.ls_past_due_since).toBe(NOW)
  })

  it('preserves an existing past_due_since so the grace is not extended', () => {
    const earlier = NOW - 5 * 24 * 60 * 60 * 1000
    const patch = patchFromSubscription(
      'sub_1',
      { ...attributes, status: 'past_due' },
      { user_id: 'u1' },
      { ls_updated_at: null, ls_past_due_since: earlier },
      NOW,
    )
    expect(patch?.ls_past_due_since).toBe(earlier)
  })

  it('clears past_due_since once the payment recovers', () => {
    const patch = patchFromSubscription(
      'sub_1',
      attributes,
      { user_id: 'u1' },
      { ls_updated_at: null, ls_past_due_since: NOW - 1000 },
      NOW,
    )
    expect(patch?.ls_past_due_since).toBeNull()
  })

  it('records the paid-through date on cancellation', () => {
    const endsAt = '2026-09-02T00:00:00.000000Z'
    const patch = patchFromSubscription(
      'sub_1',
      { ...attributes, status: 'cancelled', ends_at: endsAt },
      { user_id: 'u1' },
      null,
      NOW,
    )
    expect(patch?.ls_ends_at).toBe(Date.parse(endsAt))
  })

  it('drops a replayed event older than what we already stored', () => {
    const current = { ls_updated_at: Date.parse('2026-08-03T00:00:00Z'), ls_past_due_since: null }
    expect(patchFromSubscription('sub_1', attributes, { user_id: 'u1' }, current, NOW)).toBeNull()
  })

  it('applies an event newer than what we stored', () => {
    const current = { ls_updated_at: Date.parse('2026-08-01T00:00:00Z'), ls_past_due_since: null }
    expect(patchFromSubscription('sub_1', attributes, { user_id: 'u1' }, current, NOW)).not.toBeNull()
  })

  it('returns null with no subscription id', () => {
    expect(patchFromSubscription(null, attributes, { user_id: 'u1' }, null, NOW)).toBeNull()
  })
})
```

Create `src/lib/billing/reconcile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { RECONCILE_STALE_MS, needsReconcile } from './reconcile'

const NOW = 1_800_000_000_000

describe('needsReconcile', () => {
  it('is false for a user who never subscribed', () => {
    expect(needsReconcile({ ls_subscription_id: null, ls_updated_at: null }, NOW, false)).toBe(false)
  })

  it('is false for a freshly updated row', () => {
    const row = { ls_subscription_id: 'sub_1', ls_updated_at: NOW - 1000 }
    expect(needsReconcile(row, NOW, false)).toBe(false)
  })

  it('is true once the row is stale', () => {
    const row = { ls_subscription_id: 'sub_1', ls_updated_at: NOW - RECONCILE_STALE_MS - 1 }
    expect(needsReconcile(row, NOW, false)).toBe(true)
  })

  it('is true for a subscription that has never been stamped', () => {
    expect(needsReconcile({ ls_subscription_id: 'sub_1', ls_updated_at: null }, NOW, false)).toBe(true)
  })

  it('is true when forced, even on a fresh row', () => {
    const row = { ls_subscription_id: 'sub_1', ls_updated_at: NOW }
    expect(needsReconcile(row, NOW, true)).toBe(true)
  })

  it('stays false when forced if there is no subscription to reconcile', () => {
    expect(needsReconcile({ ls_subscription_id: null, ls_updated_at: null }, NOW, true)).toBe(false)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm test src/lib/billing
```

Expected: FAIL — cannot resolve `./webhook` or `./reconcile`.

- [ ] **Step 3: Implement the webhook module**

Create `src/lib/billing/webhook.ts`:

```ts
/**
 * Lemon Squeezy webhooks: the fast path for subscription state.
 *
 * Treated as an optimisation rather than the source of truth — a delivery can
 * be lost for good, so src/lib/billing/reconcile.ts repairs whatever this
 * misses. What must never happen is a *forged* event, so the signature is
 * verified over raw bytes before anything is parsed.
 */

import { requireDb, type WorkerEnv } from '../apiRoutes'

const encoder = new TextEncoder()

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    bytes[i] = byte
  }
  return bytes
}

/**
 * HMAC-SHA256 over the raw body, compared with `crypto.subtle.verify`, which is
 * constant-time. Never skipped in any environment: an unverified webhook
 * endpoint lets anyone grant themselves Pro.
 */
export async function verifyWebhookSignature(
  raw: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false
  const bytes = hexToBytes(signature.trim())
  if (!bytes) return false

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(raw))
}

export interface SubscriptionPatch {
  userId: string | null
  email: string | null
  ls_subscription_id: string
  ls_status: string
  ls_variant: string
  ls_renews_at: number | null
  ls_ends_at: number | null
  ls_past_due_since: number | null
  ls_updated_at: number
}

interface SubscriptionAttributes {
  status?: string
  variant_name?: string
  renews_at?: string | null
  ends_at?: string | null
  user_email?: string | null
  updated_at?: string
}

interface CurrentRow {
  ls_updated_at: number | null
  ls_past_due_since: number | null
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/** Anything not obviously annual is monthly — the two variants are ours. */
function variantOf(name: string | undefined): string {
  return /year|annual/i.test(name ?? '') ? 'annual' : 'monthly'
}

/**
 * When the grace clock starts.
 *
 * Stamped the first time `past_due` is seen and preserved on every later
 * `past_due` event, so a subscription that emits several failed-payment
 * webhooks does not keep resetting its own 14-day window. Cleared the moment
 * the status is anything else.
 */
function pastDueSince(status: string, current: CurrentRow | null, now: number): number | null {
  if (status !== 'past_due') return null
  return current?.ls_past_due_since ?? now
}

/**
 * The pure event → row patch. Returns null for an event that is stale (Lemon
 * Squeezy retries on any non-2xx, so handlers must be idempotent) or unusable.
 */
export function patchFromSubscription(
  subscriptionId: string | null,
  attributes: SubscriptionAttributes,
  customData: { user_id?: string } | null,
  current: CurrentRow | null,
  now: number,
): SubscriptionPatch | null {
  if (!subscriptionId || !attributes.status) return null

  const updatedAt = parseDate(attributes.updated_at) ?? now
  if (current?.ls_updated_at != null && updatedAt <= current.ls_updated_at) return null

  return {
    userId: customData?.user_id ?? null,
    email: attributes.user_email ?? null,
    ls_subscription_id: subscriptionId,
    ls_status: attributes.status,
    ls_variant: variantOf(attributes.variant_name),
    ls_renews_at: parseDate(attributes.renews_at),
    ls_ends_at: parseDate(attributes.ends_at),
    ls_past_due_since: pastDueSince(attributes.status, current, now),
    ls_updated_at: updatedAt,
  }
}

/** POST /api/billing/webhook */
export async function handleWebhook(
  request: Request,
  _ctx?: unknown,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim()
  if (!secret) return new Response('not configured', { status: 503 })

  // Raw text first, parsed only after the signature holds — parsing before
  // verifying would let an unauthenticated caller spend our CPU on an
  // arbitrarily large payload.
  const raw = await request.text()
  const valid = await verifyWebhookSignature(raw, request.headers.get('X-Signature'), secret)
  if (!valid) return new Response('bad signature', { status: 401 })

  let payload: {
    meta?: { custom_data?: { user_id?: string } }
    data?: { id?: string; attributes?: SubscriptionAttributes }
  }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('bad body', { status: 400 })
  }

  const subscriptionId = payload.data?.id ?? null
  const attributes = payload.data?.attributes ?? {}
  const customData = payload.meta?.custom_data ?? null

  // The row we may already hold for this subscription, for the replay guard and
  // the past_due clock.
  const current = subscriptionId
    ? await db
        .prepare(
          'SELECT ls_updated_at, ls_past_due_since FROM users WHERE ls_subscription_id = ?',
        )
        .bind(subscriptionId)
        .first<CurrentRow>()
    : null

  const patch = patchFromSubscription(subscriptionId, attributes, customData, current, Date.now())
  // 200 on a stale or unusable event: Lemon Squeezy retries non-2xx, and there
  // is nothing to retry into.
  if (!patch) return new Response('ok', { status: 200 })

  // user_id rides in checkout custom data and should always be present, since
  // checkout requires signing in first. Email is the fallback for the case that
  // should not happen.
  const target = patch.userId
    ? { column: 'id', value: patch.userId }
    : { column: 'email', value: patch.email }
  if (!target.value) return new Response('ok', { status: 200 })

  await db
    .prepare(
      `UPDATE users SET
         ls_subscription_id = ?, ls_status = ?, ls_variant = ?,
         ls_renews_at = ?, ls_ends_at = ?, ls_past_due_since = ?, ls_updated_at = ?
       WHERE ${target.column} = ?`,
    )
    .bind(
      patch.ls_subscription_id,
      patch.ls_status,
      patch.ls_variant,
      patch.ls_renews_at,
      patch.ls_ends_at,
      patch.ls_past_due_since,
      patch.ls_updated_at,
      target.value,
    )
    .run()

  return new Response('ok', { status: 200 })
}
```

- [ ] **Step 4: Implement reconcile**

Create `src/lib/billing/reconcile.ts`:

```ts
/**
 * Repair for subscription rows that webhooks lost.
 *
 * Lemon Squeezy retries failed deliveries, but a webhook can still be lost for
 * good — a deploy window, a bad response we returned, an endpoint misconfigured
 * for an hour. If webhooks were the only writer, one lost delivery would leave a
 * row permanently wrong: someone who cancelled keeping Pro, or worse, someone
 * who paid not getting it.
 *
 * Deliberately demand-driven rather than a Cron Trigger. A scheduled sweep would
 * walk every subscriber on a timer to fix accounts whose owners are not there to
 * notice; this repairs exactly the accounts someone is using, costs an integer
 * comparison when webhooks are working, and runs off the response path.
 */

import { patchFromSubscription } from './webhook'

export const RECONCILE_STALE_MS = 24 * 60 * 60 * 1000

export function needsReconcile(
  row: { ls_subscription_id: string | null; ls_updated_at: number | null },
  now: number,
  forced: boolean,
): boolean {
  if (!row.ls_subscription_id) return false
  if (forced) return true
  return (row.ls_updated_at ?? 0) + RECONCILE_STALE_MS <= now
}

/**
 * Ask Lemon Squeezy what the subscription actually is, and write it back.
 *
 * Failures are swallowed: this runs inside `waitUntil` with no one to report to,
 * and a failed repair simply leaves the row as it was for the next attempt.
 */
export async function reconcileSubscription(
  db: D1Database,
  subscriptionId: string,
  now: number,
): Promise<void> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim()
  if (!apiKey) return

  try {
    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
      {
        headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) return

    const body = await response.json<{ data?: { id?: string; attributes?: Record<string, unknown> } }>()
    const current = await db
      .prepare('SELECT ls_updated_at, ls_past_due_since FROM users WHERE ls_subscription_id = ?')
      .bind(subscriptionId)
      .first<{ ls_updated_at: number | null; ls_past_due_since: number | null }>()

    const patch = patchFromSubscription(
      body.data?.id ?? subscriptionId,
      (body.data?.attributes ?? {}) as never,
      null,
      current,
      now,
    )
    if (!patch) return

    await db
      .prepare(
        `UPDATE users SET
           ls_status = ?, ls_variant = ?, ls_renews_at = ?,
           ls_ends_at = ?, ls_past_due_since = ?, ls_updated_at = ?
         WHERE ls_subscription_id = ?`,
      )
      .bind(
        patch.ls_status,
        patch.ls_variant,
        patch.ls_renews_at,
        patch.ls_ends_at,
        patch.ls_past_due_since,
        patch.ls_updated_at,
        subscriptionId,
      )
      .run()
  } catch {
    // Nothing to do — the next refresh tries again.
  }
}
```

- [ ] **Step 5: Implement the portal**

Create `src/lib/billing/portal.ts`:

```ts
/**
 * A fresh signed customer-portal URL, per click.
 *
 * Lemon Squeezy signs these and expires them after 24 hours, and their docs say
 * not to store them — a cached URL would be a dead "Manage billing" button a day
 * after the last webhook.
 */

import { requireDb, type WorkerEnv } from '../apiRoutes'
import { SESSION_COOKIE, loadSession, readCookie } from '../auth/session'

/** GET /api/billing/portal */
export async function handlePortal(
  request: Request,
  _ctx?: unknown,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim()
  if (!apiKey) {
    return Response.json(
      { success: false, error: 'Billing is not configured on this deployment.' },
      { status: 503 },
    )
  }

  const user = await loadSession(
    db,
    readCookie(request.headers.get('Cookie'), SESSION_COOKIE),
    Date.now(),
  )
  if (!user?.ls_subscription_id) {
    return Response.json({ success: false, error: 'No subscription' }, { status: 404 })
  }

  try {
    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${user.ls_subscription_id}`,
      {
        headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) throw new Error('upstream')

    const body = await response.json<{
      data?: { attributes?: { urls?: { customer_portal?: string } } }
    }>()
    const portal = body.data?.attributes?.urls?.customer_portal
    if (!portal) throw new Error('no portal url')

    return new Response(null, { status: 302, headers: { Location: portal } })
  } catch {
    return Response.json(
      { success: false, error: 'Could not open the billing portal. Try again.' },
      { status: 502 },
    )
  }
}
```

- [ ] **Step 6: Register both routes**

In `src/lib/apiRoutes.ts`:

```ts
import { handleWebhook } from './billing/webhook'
import { handlePortal } from './billing/portal'
```

```ts
  '/api/billing/webhook': { method: 'POST', handler: handleWebhook },
  '/api/billing/portal': { method: 'GET', handler: handlePortal },
```

- [ ] **Step 7: Run everything**

```bash
pnpm test && pnpm lint && pnpm cf:build
```

Expected: PASS, 16 new tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/billing src/lib/apiRoutes.ts
git commit -m "feat(billing): add the subscription webhook, portal, and lazy reconcile"
```

---

## Task 8: Client entitlement rewrite

`useTier()` and `useProToken()` keep their exact public shape, so `DownloaderApp` and `PromoSlot` are untouched. Everything behind them changes.

**Files:**
- Modify: `src/lib/entitlements.ts` (rewrite)
- Delete: `src/lib/entitlements.test.ts`
- Create: `src/lib/account.ts`, `src/lib/account.test.ts`

**Interfaces:**
- Produces (`src/lib/account.ts`): `interface AccountState`, `hasAccountHint(): boolean`, `useAccount(): AccountState`, `refreshAccount(opts?: { force?: boolean }): Promise<void>`, `signOut(all?: boolean): Promise<void>`, `signInHref(redirectTo?: string): string`
- Produces (`src/lib/entitlements.ts`): `useTier(): 'free' | 'pro'`, `useProToken(): string | null` — unchanged signatures

- [ ] **Step 1: Write the failing test for the pure part**

Create `src/lib/account.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { signInHref, tokenIsUsable } from './account'

describe('signInHref', () => {
  it('points at the start endpoint with no destination', () => {
    expect(signInHref()).toBe('/api/auth/google')
  })

  it('carries an encoded destination', () => {
    expect(signInHref('/account?checkout=success')).toBe(
      '/api/auth/google?redirect_to=%2Faccount%3Fcheckout%3Dsuccess',
    )
  })
})

describe('tokenIsUsable', () => {
  const NOW = 1_800_000_000_000

  it('is false with no token', () => {
    expect(tokenIsUsable(null, NOW)).toBe(false)
  })

  it('is true for a token with time left', () => {
    expect(tokenIsUsable({ token: 'x', expiresAt: NOW + 60_000 }, NOW)).toBe(true)
  })

  it('is false within the refresh margin, so a resolve never races expiry', () => {
    expect(tokenIsUsable({ token: 'x', expiresAt: NOW + 10_000 }, NOW)).toBe(false)
  })

  it('is false once expired', () => {
    expect(tokenIsUsable({ token: 'x', expiresAt: NOW - 1 }, NOW)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm test src/lib/account.test.ts
```

Expected: FAIL — cannot resolve `./account`.

- [ ] **Step 3: Implement the account store**

Create `src/lib/account.ts`:

```ts
'use client'

/**
 * Client-side account state.
 *
 * The access token is held in memory only and never persisted: it lives 15
 * minutes, and the durable credential is the httpOnly session cookie the
 * browser sends on its own. Nothing here is trusted — every entitlement
 * decision is made server-side and merely reported to this module.
 *
 * Modelled as an external store for the same reason as lib/prefs.ts: a
 * useSyncExternalStore snapshot avoids the render → effect → setState cascade
 * and the hydration mismatch that a mount effect would cause.
 */

import { useSyncExternalStore } from 'react'
import { HINT_COOKIE } from './auth/session'

/** Refresh this far before expiry, so a resolve never races the deadline. */
const REFRESH_MARGIN_MS = 30_000

export interface PlanState {
  status: string | null
  variant: string | null
  renewsAt: number | null
  endsAt: number | null
  pastDueSince: number | null
}

export interface AccountState {
  /** Undefined until the first refresh settles. */
  signedIn: boolean | undefined
  pro: boolean
  email: string | null
  plan: PlanState | null
}

interface Token {
  token: string
  expiresAt: number
}

export function tokenIsUsable(token: Token | null, now: number): boolean {
  if (!token) return false
  return token.expiresAt - now > REFRESH_MARGIN_MS
}

export function signInHref(redirectTo?: string): string {
  if (!redirectTo) return '/api/auth/google'
  return `/api/auth/google?redirect_to=${encodeURIComponent(redirectTo)}`
}

/**
 * Whether the browser is probably signed in, answered synchronously with no
 * network call. The header renders from this so that a page view still invokes
 * no Worker at all — see src/lib/auth/session.ts.
 */
export function hasAccountHint(): boolean {
  try {
    return document.cookie.split(';').some((part) => part.trim().startsWith(`${HINT_COOKIE}=1`))
  } catch {
    return false
  }
}

const SIGNED_OUT: AccountState = Object.freeze({
  signedIn: false,
  pro: false,
  email: null,
  plan: null,
})

const UNKNOWN: AccountState = Object.freeze({
  signedIn: undefined,
  pro: false,
  email: null,
  plan: null,
})

let state: AccountState = UNKNOWN
let token: Token | null = null
let inFlight: Promise<void> | null = null

const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = (): AccountState => state
const getServerSnapshot = (): AccountState => UNKNOWN

/**
 * Lazy, never on a timer.
 *
 * A 15-minute heartbeat would be 96 requests per user per day; at a thousand
 * subscribers that alone would exhaust the 100k/day request budget the
 * downloader needs. Refreshing on demand ties cost to activity instead.
 */
export async function refreshAccount(opts: { force?: boolean } = {}): Promise<void> {
  if (!opts.force && tokenIsUsable(token, Date.now())) return
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const response = await fetch(`/api/auth/refresh${opts.force ? '?reconcile=1' : ''}`, {
        method: 'POST',
      })
      if (response.status === 401) {
        token = null
        state = SIGNED_OUT
        notify()
        return
      }
      if (!response.ok) return

      const data = await response.json()
      if (!data?.success) return

      token = { token: data.token, expiresAt: data.expiresAt }
      state = {
        signedIn: true,
        pro: data.pro === true,
        email: data.email ?? null,
        plan: data.plan ?? null,
      }
      notify()

      const { adoptServerPrefs } = await import('./prefs')
      adoptServerPrefs(data.prefs)
    } catch {
      // Network failure. Deliberately leaves the existing token in place: a
      // paying customer must never be downgraded because one request failed.
      // A genuinely dead session keeps failing until the token expires on its
      // own, which bounds the worst case to one TTL.
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

export async function signOut(all = false): Promise<void> {
  try {
    await fetch(`/api/auth/logout${all ? '?all=1' : ''}`, { method: 'POST' })
  } catch {
    // The cookies are cleared server-side; a failure here just means retrying.
  }
  token = null
  state = SIGNED_OUT
  notify()
}

export function useAccount(): AccountState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** The in-memory access token, or null. Consumed by useProToken. */
export function currentAccessToken(): string | null {
  if (!token) return null
  if (token.expiresAt <= Date.now()) return null
  return token.token
}

/** Called before a resolve, so the token in hand is fresh enough to use. */
export function ensureFreshToken(): void {
  if (!hasAccountHint()) return
  void refreshAccount()
}
```

- [ ] **Step 4: Rewrite `entitlements.ts`**

Replace the entire contents of `src/lib/entitlements.ts`:

```ts
'use client'

/**
 * Pro state, as the app sees it.
 *
 * The whole implementation moved from a license key in localStorage to a Google
 * account with a server session — but the two hooks below kept their exact
 * shapes, which is why DownloaderApp and PromoSlot did not change at all.
 *
 * As before, the ad-free half of Pro is enforced client-side and is trivially
 * bypassable. That is accepted: the honest subscriber is the customer, and the
 * entitlement that actually costs us something (priority resolve) is checked
 * server-side against a signed token.
 */

import { useEffect } from 'react'
import { currentAccessToken, ensureFreshToken, useAccount } from './account'

/**
 * Free on the server and during hydration, so the markup never differs.
 * Consumers that render something whose presence must never flash (the sponsor
 * card) additionally gate on `useHydrated()` themselves — see PromoSlot —
 * because this hook alone only guarantees no hydration mismatch, not that the
 * client value is known on the very first client render.
 */
export function useTier(): 'free' | 'pro' {
  const account = useAccount()
  useEffect(() => {
    ensureFreshToken()
  }, [])
  return account.pro ? 'pro' : 'free'
}

export function useProToken(): string | null {
  // Subscribing to the account store is what re-renders this when a refresh
  // lands; the token itself is read imperatively because it is not part of the
  // snapshot (a fresh string each call would re-render forever).
  useAccount()
  return currentAccessToken()
}
```

- [ ] **Step 5: Delete the obsolete test**

```bash
git rm src/lib/entitlements.test.ts
```

- [ ] **Step 6: Run everything**

```bash
pnpm test && pnpm lint
```

Expected: PASS, 6 new tests in `account.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib
git commit -m "feat(auth): move client entitlement from license keys to account sessions"
```

---

## Task 9: Preference sync

Extends the existing store rather than replacing it.

**Files:**
- Modify: `src/lib/prefs.ts`
- Create: `src/lib/prefs.test.ts`

**Interfaces:**
- Produces: `normalisePrefs(value: unknown): Prefs | null`, `mergePrefs(local: Prefs, server: Prefs | null): Prefs`, `adoptServerPrefs(raw: string | null): void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/prefs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mergePrefs, normalisePrefs } from './prefs'

describe('normalisePrefs', () => {
  it('accepts a well-formed object', () => {
    expect(normalisePrefs({ quality: 'sd', format: 'audio' })).toEqual({
      quality: 'sd',
      format: 'audio',
    })
  })

  it('accepts a JSON string, which is how the column is stored', () => {
    expect(normalisePrefs('{"quality":"sd","format":"video"}')).toEqual({
      quality: 'sd',
      format: 'video',
    })
  })

  it('fills a missing field with the default rather than rejecting', () => {
    expect(normalisePrefs({ quality: 'sd' })).toEqual({ quality: 'sd', format: 'video' })
  })

  it('rejects an unknown quality', () => {
    expect(normalisePrefs({ quality: '4k', format: 'video' })).toBeNull()
  })

  it('rejects an unknown format', () => {
    expect(normalisePrefs({ quality: 'hd', format: 'gif' })).toBeNull()
  })

  it('returns null for null', () => {
    expect(normalisePrefs(null)).toBeNull()
  })

  it('returns null for malformed JSON rather than throwing', () => {
    expect(normalisePrefs('{not json')).toBeNull()
  })
})

describe('mergePrefs', () => {
  const local = { quality: 'sd', format: 'audio' } as const

  it('pushes local preferences up on a first login', () => {
    expect(mergePrefs(local, null)).toEqual(local)
  })

  it('lets the server win once it has values', () => {
    const server = { quality: 'hd', format: 'video' } as const
    expect(mergePrefs(local, server)).toEqual(server)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm test src/lib/prefs.test.ts
```

Expected: FAIL — `normalisePrefs` is not exported.

- [ ] **Step 3: Extend `src/lib/prefs.ts`**

Append to the module:

```ts
/**
 * Validate whatever arrived from the network or the database.
 *
 * Accepts both the parsed object and the raw JSON string, because the `prefs`
 * column stores a string and the API hands back either. A missing field falls
 * back to its default; a *wrong* field is rejected outright, since that means
 * something upstream is confused and silently coercing it would hide the bug.
 */
export function normalisePrefs(value: unknown): Prefs | null {
  if (value === null || value === undefined) return null

  let candidate = value
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return null
    }
  }
  if (typeof candidate !== 'object' || candidate === null) return null

  const { quality, format } = candidate as { quality?: unknown; format?: unknown }
  if (quality !== undefined && !isQuality(quality as string)) return null
  if (format !== undefined && !isFormat(format as string)) return null

  return {
    quality: (quality as Quality) ?? DEFAULTS.quality,
    format: (format as Format) ?? DEFAULTS.format,
  }
}

/**
 * Server wins when it has an opinion; otherwise the local choices are carried
 * up. Signing in must never silently change how the tool behaves for someone
 * who already set their preferences in this browser.
 */
export function mergePrefs(local: Prefs, server: Prefs | null): Prefs {
  return server ?? local
}

/**
 * Called after a refresh with whatever the `prefs` column held. Pushes local
 * values up on a first login, and adopts the server's on every later one.
 */
export function adoptServerPrefs(raw: unknown): void {
  const server = normalisePrefs(raw)
  const merged = mergePrefs(getSnapshot(), server)

  if (!server) {
    void persistPrefs(merged)
    return
  }

  if (merged.quality !== getSnapshot().quality) setQuality(merged.quality)
  if (merged.format !== getSnapshot().format) setFormat(merged.format)
}

/** Write the current preferences to the account, if there is one. */
export async function persistPrefs(prefs: Prefs): Promise<void> {
  try {
    await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs }),
    })
  } catch {
    // Local storage already has the value; the next change retries.
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm test src/lib/prefs.test.ts && pnpm lint
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prefs.ts src/lib/prefs.test.ts
git commit -m "feat(prefs): sync download preferences to the account"
```

---

## Task 10: The account control and the past-due banner

**Files:**
- Create: `src/components/AccountControl.tsx`, `src/components/PastDueBanner.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx` (one hero chip)

- [ ] **Step 1: Build the control**

Create `src/components/AccountControl.tsx`:

```tsx
'use client'

/**
 * The site's only account affordance: a small control pinned to the top-right
 * of every page.
 *
 * Deliberately not a header bar. This site has never had one — every page is a
 * standalone layout tuned to a 96 mobile Lighthouse score — and introducing one
 * to hold a single link would be a far larger visual change than the feature
 * warrants.
 *
 * It renders from the `smd_account` hint cookie, read synchronously with no
 * network call, because a page view must keep invoking no Worker at all. The
 * slot is fixed-size and renders empty until hydration, so there is no "Sign in"
 * flash for a signed-in visitor and no layout shift for anyone.
 */

import Link from 'next/link'
import { hasAccountHint, signInHref } from '@/lib/account'
import { useHydrated } from '@/lib/clientEnv'

export function AccountControl() {
  const hydrated = useHydrated()
  const signedIn = hydrated && hasAccountHint()

  return (
    <div className='pointer-events-none fixed top-3 right-3 z-50 flex h-9 items-center justify-end sm:top-4 sm:right-4'>
      {hydrated && (
        <Link
          href={signedIn ? '/account' : signInHref()}
          className='pointer-events-auto rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 text-xs font-medium text-white/60 backdrop-blur transition-colors hover:border-white/20 hover:text-white'
        >
          {signedIn ? 'Account' : 'Sign in'}
        </Link>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build the past-due banner**

Create `src/components/PastDueBanner.tsx`:

```tsx
'use client'

/**
 * The single interruption this entire feature is allowed to put on the
 * downloader, and only for someone who is already paying.
 *
 * A subscriber in the grace window is still using Pro normally and has no
 * reason to open their account page before it runs out — so the one state that
 * ends in losing access has to find them, not wait to be found.
 */

import { PAST_DUE_GRACE_MS } from '@/lib/billing/entitlement'
import { useAccount } from '@/lib/account'

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

export function PastDueBanner() {
  const { plan } = useAccount()
  if (plan?.status !== 'past_due' || plan.pastDueSince === null) return null

  const endsAt = plan.pastDueSince + PAST_DUE_GRACE_MS
  if (endsAt <= Date.now()) return null

  return (
    <div
      role='status'
      className='mx-auto mb-4 flex max-w-3xl flex-col gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between'
    >
      <p>
        We couldn&rsquo;t take payment. Pro stays on until {formatDate(endsAt)}.
      </p>
      <a
        href='/api/billing/portal'
        className='shrink-0 rounded-lg bg-amber-400/20 px-3 py-1.5 font-semibold text-amber-50 transition-colors hover:bg-amber-400/30'
      >
        Update payment method
      </a>
    </div>
  )
}
```

- [ ] **Step 3: Mount the control in the layout**

In `src/app/layout.tsx`, import `AccountControl` and render it inside `<body>`, immediately before `{children}`.

- [ ] **Step 4: Reword the hero chip**

In `src/app/page.tsx`, change the `heroChips` entry `'No login required'` to `'No login to download'`.

The claim stays true and stays a selling point, but a "Sign in" control three centimetres away from the words "No login required" reads as a contradiction to anyone scanning the page. The reworded version says the thing that actually matters.

- [ ] **Step 5: Render the banner**

In `src/components/DownloaderApp.tsx`, import `PastDueBanner` and render it directly above the paste form.

- [ ] **Step 6: Verify**

```bash
pnpm lint && pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/AccountControl.tsx src/components/PastDueBanner.tsx src/app/layout.tsx src/app/page.tsx src/components/DownloaderApp.tsx
git commit -m "feat(ui): add the account control and the past-due banner"
```

---

## Task 11: The account page

**Files:**
- Create: `src/app/account/page.tsx`, `src/components/AccountPanel.tsx`

- [ ] **Step 1: Build the panel**

Create `src/components/AccountPanel.tsx` as a client component with three sections. Requirements, all load-bearing:

- On mount, call `refreshAccount()`. While `signedIn === undefined`, render a fixed-height skeleton — never a "signed out" state, which would flash for every signed-in visitor.
- When `signedIn === false`, render a sign-in prompt linking to `signInHref('/account')`.
- **Plan section**, exactly these states, keyed off `plan.status` and `isProAt`:

| Condition | Copy | Action |
|---|---|---|
| no `ls_status` | "You're on the free plan." | two buttons: `$3/month` and `$24/year` (annual first, marked "Best value") |
| `active`/`on_trial`, monthly | "Pro · $3/month · renews {date}" | "Manage billing" → `/api/billing/portal` |
| `active`/`on_trial`, annual | "Pro · $24/year · renews {date}" plus the booking link | "Manage billing" |
| `cancelled` | "Pro until {endsAt}. Won't renew after that." | "Resubscribe" |
| `past_due` | "We couldn't take payment. Pro stays on until {pastDueSince + PAST_DUE_GRACE_MS}." | "Update payment method" |
| `paused`/`unpaid`/`expired` | "Your subscription ended." | "Subscribe again" |

  Use a lookup object or `switch` keyed on status — **no nested ternaries**.
- Checkout links append `?checkout[custom][user_id]=<id>&checkout[email]=<email>` to the URLs from `src/config/pro.ts`, and redirect back to `/account?checkout=success`.
- On `?checkout=success`, poll `refreshAccount({ force: true })` every 2s for up to 30s while `pro` is false, showing "Setting up your subscription…". After 30s: "Your payment went through. This can take a minute — refresh, or email us if it persists."
- **Preferences section**: HD/Data-saver and Video/Audio toggles bound to `usePrefs`/`setQuality`/`setFormat`, calling `persistPrefs` after each change.
- **Account section**: email, "Sign out" (`signOut()`), "Sign out everywhere" (`signOut(true)`, behind a confirm), "Delete account" (behind a confirm, warning that it does not cancel a live subscription and linking to the portal first).
- Reuse `Surface` for every card. Match the styling of `/pro`.

- [ ] **Step 2: Build the route**

Create `src/app/account/page.tsx` mirroring `src/app/pro/page.tsx`'s structure: same `app-bg` wrapper, same container widths, `metadata` with `title: 'Account'` and `robots: { index: false }` — an account page has nothing to index and should not appear in search.

- [ ] **Step 3: Verify**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/account src/components/AccountPanel.tsx
git commit -m "feat(account): add the account page with plan, preferences, and sessions"
```

---

## Task 12: Delete the license system

**Files:**
- Delete: `src/components/ProLicensePanel.tsx`, `src/app/api/license/route.ts`, `scripts/ls-finish.mjs`
- Modify: `src/lib/apiRoutes.ts`, `package.json`, `scripts/cf-smoke.mjs`

- [ ] **Step 1: Delete the files**

```bash
git rm src/components/ProLicensePanel.tsx src/app/api/license/route.ts scripts/ls-finish.mjs
```

- [ ] **Step 2: Strip the handler**

In `src/lib/apiRoutes.ts`, delete `handleLicense`, the `LEMON_API` constant, and the `'/api/license'` route-table entry. Remove any now-unused imports.

- [ ] **Step 3: Drop the script alias**

Remove `"ls:finish"` from `package.json` scripts.

- [ ] **Step 4: Replace the smoke assertions**

In `scripts/cf-smoke.mjs`, replace the `api/license rejects an empty body cleanly` case (around line 534) with:

```js
    {
      // The auth routes are registered in API_ROUTES precisely so a request
      // never initialises Next. A refresh with no session cookie must fail
      // cleanly — 401 when D1 is bound, 503 when it is not — and must never
      // return the 404 page, which would mean the Worker is not serving it.
      name: 'api/auth/refresh rejects an anonymous caller cleanly',
      request: { pathname: '/api/auth/refresh', method: 'POST' },
      check: (response, payload) => {
        if (![401, 503].includes(response.status)) {
          return `expected 401 or 503, got ${response.status}`
        }
        if (payload.success) return 'anonymous refresh was accepted'
        return null
      },
    },
    {
      name: 'api/billing/webhook rejects an unsigned body',
      request: { pathname: '/api/billing/webhook', method: 'POST', json: {} },
      check: (response) => {
        if (![401, 503].includes(response.status)) {
          return `expected 401 or 503, got ${response.status}`
        }
        return null
      },
    },
```

Match the surrounding cases' exact object shape — read the neighbours before writing this; the shape above is indicative, the file's own convention wins.

- [ ] **Step 5: Verify nothing references the deleted names**

```bash
grep -rn "ProLicensePanel\|handleLicense\|licenseToken\|activateLicense\|ls-finish\|LICENSE_TOKEN_SECRET" src scripts package.json
```

Expected: no matches.

- [ ] **Step 6: Run everything**

```bash
pnpm test && pnpm lint && pnpm cf:build
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(pro): delete the license key system"
```

---

## Task 13: Copy, configuration, and documentation

**Files:**
- Modify: `src/config/pro.ts`, `src/app/pro/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `.env.sample`, `.env.cloudflare.sample`, `README.md`

- [ ] **Step 1: Rewrite `src/config/pro.ts`**

```ts
/**
 * Pro's commercial constants, in one place.
 *
 * Two variants, one entitlement. Annual is presented first everywhere: Lemon
 * Squeezy charges 5% + 50¢, so the flat fee takes 22% of a $3 charge and 7% of
 * a $24 one — twelve monthly renewals net $28.20 against $22.30 for an annual,
 * which makes annual worth 79% of the revenue while removing eleven chances to
 * churn and eleven flat fees.
 */

export const PRO_CHECKOUT_MONTHLY = 'TEMPLATE_LS_MONTHLY_URL'
export const PRO_CHECKOUT_ANNUAL = 'TEMPLATE_LS_ANNUAL_URL'

export const PRO_PRICE_MONTHLY = '$3'
export const PRO_PRICE_ANNUAL = '$24'

/** One label for one intent, used at every entry point. */
export const PRO_CTA_LABEL = `Get Pro, ${PRO_PRICE_MONTHLY}/mo`

export function isProCheckoutConfigured(url: string): boolean {
  return url.startsWith('https://')
}

/**
 * Attach the buyer to the checkout so the webhook can find them. Checkout
 * requires signing in first, so `userId` is always present in practice; the
 * webhook falls back to matching on email if it ever is not.
 */
export function checkoutHref(base: string, userId: string, email: string): string {
  const url = new URL(base)
  url.searchParams.set('checkout[custom][user_id]', userId)
  url.searchParams.set('checkout[email]', email)
  return url.toString()
}
```

- [ ] **Step 2: Rewrite `/pro`**

- Headline: `One account.` / `<span className='text-grad'>Every device.</span>`
- Sub: "$3 a month, or $24 a year. Sign in with Google — no password to remember, and the downloader stays exactly as free as it is today either way."
- Price block: annual first, marked "Best value", monthly beside it.
- Replace the "5 activations" sentence with "Signed in on up to 5 devices at once."
- Add two feature cards to the existing four:
  - **"Ask for features"** — "Pro subscribers can request features and get a real answer from the person who builds this, not a support queue."
  - **"Talk to the developer"** — "Annual subscribers can book a call. Limited slots each month, so it stays a real conversation."
- Replace `<ProLicensePanel />` with a sign-in prompt for signed-out visitors and a link to `/account` for signed-in ones.
- Update the metadata description: drop "No account, no subscription."

- [ ] **Step 3: Rewrite `/privacy`**

Must state, plainly and separately:
- Free users: no account, nothing stored, fully anonymous. Unchanged.
- Pro users: email address, Google account ID, and a list of signed-in devices.
- No download activity is recorded, for anyone.
- No IP addresses are stored.
- Google handles authentication; we never see a password.
- Deleting the account removes the record and all sessions, via `/account`.

- [ ] **Step 4: Rewrite `/terms`**

Replace the one-time-purchase language: billing period, automatic renewal, cancellation taking effect at the end of the paid period, what happens on a failed payment (14 days, then access ends), and the refund policy for a recurring charge.

- [ ] **Step 5: Update both env samples**

In `.env.sample` and `.env.cloudflare.sample`, replace the `LICENSE_TOKEN_SECRET` block. **Correct** the existing comment claiming no Lemon Squeezy API key is needed — that was true of the license endpoints and is now false.

```bash
# HMAC key for Pro access tokens and session cookies (WebCrypto HMAC-SHA256).
# Generate with: openssl rand -base64 32
PRO_TOKEN_SECRET=

# Google OAuth client. Create at console.cloud.google.com, and register BOTH
# redirect URIs: http://localhost:8787/api/auth/callback (wrangler dev) and
# https://<your-domain>/api/auth/callback.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Lemon Squeezy. The API key is required: customer-portal URLs are signed and
# expire after 24 hours, so they are fetched per click rather than stored, and
# the same key backs the subscription reconcile.
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_WEBHOOK_SECRET=
```

- [ ] **Step 6: Update the README**

Replace the license-key section with the accounts flow, the new secrets, and the dashboard setup order from the spec's Configuration section.

- [ ] **Step 7: Verify**

```bash
pnpm lint && pnpm build && pnpm test
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs(pro): rewrite the Pro, privacy, and terms copy for subscriptions"
```

---

## Task 14: Verify the CPU budget

The one task that cannot be skipped. A Worker cannot time itself — `Date.now()` does not advance during synchronous execution on workerd — so this is measured externally.

- [ ] **Step 1: Record the baseline before the branch**

```bash
git stash
pnpm preview
```

In a second terminal, `pnpm exec wrangler tail --format json`, then send an anonymous `/api/download`. Record `cpuTime`. Then `git stash pop`.

- [ ] **Step 2: Measure the branch**

```bash
pnpm preview
```

With `wrangler tail` running, capture `cpuTime` for each of:

| Request | Requirement |
|---|---|
| anonymous `POST /api/download` | **must match the baseline** — this is the blocker |
| `POST /api/download` with a valid `X-Pro-Token` | within 1 ms of the baseline |
| `GET /api/auth/callback` on a cold isolate | < 10 ms |
| `POST /api/auth/refresh` | < 5 ms |

- [ ] **Step 3: If the anonymous download regressed**

The cause is almost certainly a module-scope import pulling auth or billing code into the shared route table. Check that `arctic`, `reconcile`, and `prefs` are all reached via `await import()` inside handler bodies, and that `src/lib/auth/routes.ts` imports only types at module scope from anything heavy.

- [ ] **Step 4: Run the smoke suite**

```bash
node scripts/cf-smoke.mjs
```

- [ ] **Step 5: Record the numbers**

Add a short "Measured" section to the spec with the four figures and the baseline, then commit:

```bash
git add docs/superpowers/specs/2026-08-02-accounts-subscriptions-design.md
git commit -m "docs(spec): record the measured CPU figures"
```

---

## Task 15: Dashboard configuration and the manual purchase test

Not code, and where most of the wall-clock time goes. Do this last, against a preview deployment.

- [ ] **Step 1: Google Cloud**

Create an OAuth 2.0 client (Web application). Configure the consent screen with the app name, support email, and the privacy-policy and terms URLs. Add both redirect URIs. Scopes: `openid` and `email` only.

- [ ] **Step 2: Lemon Squeezy**

Convert the existing product to a subscription with two variants ($3/month, $24/year). **Turn off license key generation.** Create a webhook pointing at `https://<domain>/api/billing/webhook`, subscribe to `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`, and `subscription_payment_failed`, and copy the signing secret. Set the redirect-after-purchase URL to `https://<domain>/account?checkout=success`. Copy both variants' `buy_now_url` into `src/config/pro.ts`.

- [ ] **Step 3: Cloudflare**

```bash
pnpm exec wrangler d1 execute social-media-downloader --remote --file=migrations/0001_accounts.sql
pnpm exec wrangler secret put PRO_TOKEN_SECRET
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
pnpm exec wrangler secret put LEMONSQUEEZY_API_KEY
pnpm exec wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET
pnpm exec wrangler secret delete LICENSE_TOKEN_SECRET
```

- [ ] **Step 4: Walk the purchase path**

Sign in with Google. Confirm the session cookie is `HttpOnly` and `Secure` and that `smd_account` is not `HttpOnly`. Subscribe monthly. Confirm `/account` shows Pro within seconds. Confirm a resolve sends `X-Pro-Token` and takes the priority path. Cancel in the portal, and confirm `/account` reads "Pro until {date}" and that Pro still works.

- [ ] **Step 5: Walk the repair path**

The one thing no unit test can prove. Disable the webhook in Lemon Squeezy, change the subscription there, then load `/account` and confirm it corrects itself on the next refresh. Re-enable the webhook.

- [ ] **Step 6: Confirm the device cap**

Sign in from six browsers or profiles. Confirm the first session is signed out.

- [ ] **Step 7: Confirm Lighthouse**

Run mobile Lighthouse on `/`. Must still be 96 or better, with no new layout shift from the account control.

- [ ] **Step 8: Commit the checkout URLs**

```bash
git add src/config/pro.ts
git commit -m "feat(pro): point checkout at the live monthly and annual variants"
```

---

## Self-review

**Spec coverage.** Every section maps to a task: performance budget → Global Constraints + Task 14; product/pricing → Tasks 11, 13; architecture → Tasks 1, 3, 4, 5, 6; lazy reconcile → Task 7; data model → Task 1; entitlement → Task 2; endpoints → Tasks 6, 7; header entry point → Task 10; signed-in extras → Task 9; `/account` states → Task 11; cancelling and checkout return → Task 11; failure handling → Tasks 6, 7, 8; deletions → Task 12; configuration → Tasks 13, 15; cost → Task 14; privacy and terms → Task 13; testing → Tasks 2, 4, 5, 7, 8, 9, 14, 15.

**Known gaps, deliberate.** Task 11 specifies the account panel as a requirements table rather than complete JSX — it is presentational, has no logic worth a test beyond the status lookup, and must match the existing `Surface` styling, which is better read from `/pro` than transcribed here. The status→copy mapping must be a lookup object or `switch`, never nested ternaries.

**Ordering.** Task 6 forward-references `reconcile.ts` (Task 7) and `normalisePrefs` (Task 9) through dynamic imports. Both are noted in Task 6, Step 3. Executing 1→15 in order, the only build failure is at Task 6 Step 3, which resolves once Tasks 7 and 9 land. Tasks 7, 8, and 9 have no dependency on each other and can run in parallel.
