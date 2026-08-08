# Monetization Implementation Plan

> **Superseded — historical record, do not implement from it.** The Pro layer
> here (a $9 one-time Lemon Squeezy licence key in `localStorage`, `/api/license`,
> activation slots) was replaced by a subscription behind a Google account, and
> Lemon Squeezy later rejected the application, so the merchant of record is
> Creem. The affiliate/offers and donation parts of this plan did ship and are
> still accurate. The shipped billing contract is the README's "Accounts and Pro
> subscriptions" section plus `src/lib/billing/`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add affiliate offers, a one-time Pro license (batch downloads, no sponsor card, priority resolve), donations, and a flag-gated display-ad slot to an existing free downloader, without breaking any UX promise it currently makes.

**Architecture:** Every commercial pixel on the site renders through one component, `PromoSlot`, which owns the placement rules. Offers are plain data in `src/config/offers.ts`; selection is a pure function in `src/lib/promo.ts`. Pro is a Lemon Squeezy license key held in `localStorage` and exchanged at `/api/license` for a short-lived HMAC token, verified in-Worker with WebCrypto. Batch reuses the existing resolve pipeline, extracted from `DownloaderApp` into `src/lib/resolve.ts`.

**Tech Stack:** Next 16 (static export, `output: 'export'`), React 19, Tailwind 4, TypeScript 6, Cloudflare Workers (`cloudflare/worker.js` + `src/lib/apiRoutes.ts`), Vitest (added by Task 1), Lemon Squeezy license API, JSZip (already a dependency).

## Global Constraints

- Package manager is **pnpm only**. Never run `npm` or `yarn`. Delete any `package-lock.json` that appears.
- Commit subjects start with the type (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). No leading or trailing `@` or other paste artifacts. **No AI co-author trailer** on any commit.
- **No nested ternaries** anywhere. Extract a named helper instead. Single-level ternaries are fine.
- Never paywall, gate, degrade, or rate-limit any capability that exists on 2026-07-31. Pro only adds.
- Never require an account or login. The license key is the only credential.
- No popunders, redirects, interstitials, or countdown gates.
- `PromoSlot` must reserve its height before paint. CLS attributable to it must be 0.
- No promo renders above the fold, during a resolve, or during a download.
- Lighthouse mobile must stay ≥ 96. Do not enable `optimizeCss` (it breaks `@property`/conic/mask).
- New API handlers go in `src/lib/apiRoutes.ts` against plain `Request`/`Response`, are registered in `API_ROUTES`, and get a thin `src/app/api/<name>/route.ts` wrapper. This is required by the 10 ms Worker CPU budget — see the file header.
- No `axios` in Worker paths. Use the existing `http` client from `src/lib/httpClient.ts` or plain `fetch`.
- Do not animate `filter` on `.glow-card::before`. Result-card sections animate with the CSS class `.animate-section-in`, never with framer/motion height animations.
- localStorage keys are namespaced `smd:` (matching `INSTALL_DISMISS_KEY = 'smd:install-dismissed'`).
- Secrets are set with `wrangler secret put <NAME>` and never committed. `wrangler.jsonc` `vars` is for non-secret values only.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Test runner config, node environment, `src/**/*.test.ts` only |
| `src/config/offers.ts` | Offer catalogue — pure data, the one file edited to add/kill an offer |
| `src/lib/promo.ts` | Offer selection + dismissal state. Pure, tested |
| `src/lib/promo.test.ts` | Tests for the above |
| `src/components/PromoSlot.tsx` | The single rendering surface for all commercial content |
| `src/app/privacy/page.tsx` | Privacy policy + affiliate disclosure |
| `src/app/terms/page.tsx` | Terms of use |
| `src/app/pro/page.tsx` | Pricing, what a key unlocks, key-entry field |
| `src/lib/licenseToken.ts` | HMAC-SHA256 sign/verify over `{k, exp}`. Pure, tested |
| `src/lib/licenseToken.test.ts` | Tests for the above |
| `src/lib/entitlements.ts` | `useTier()` hook + key storage + 24h revalidation |
| `src/lib/resolve.ts` | The resolve pipeline, extracted from `DownloaderApp` |
| `src/lib/batchQueue.ts` | Bounded-concurrency queue over `resolve()`. Pure, tested |
| `src/lib/batchQueue.test.ts` | Tests for the above |
| `src/components/BatchPanel.tsx` | Pro batch UI |
| `.github/FUNDING.yml` | GitHub Sponsors / Ko-fi wiring |

**Modified:**

| File | Change |
|---|---|
| `package.json` | `test` script, vitest devDependency |
| `src/components/DownloaderApp.tsx:2160` | Mount `PromoSlot` after the result card, before the lightbox; mount `BatchPanel` |
| `src/components/PlatformLanding.tsx:314` | Mount in-content `PromoSlot`; footer links |
| `src/app/page.tsx:453-493` | Footer links (donate, Pro, privacy, terms) |
| `src/app/layout.tsx` | Cloudflare Web Analytics beacon |
| `src/lib/apiRoutes.ts` | `handleLicense`, `API_ROUTES` entry, Pro token check in `handleDownload` |
| `src/lib/downloader.ts:217,254` | `priority` option reorders `cobaltInstances` |
| `README.md` | Honest ad copy, sponsor block, donate links |

---

### Task 1: Test harness

No test runner exists in this repo. Three pure modules in this plan (offer selection, license tokens, batch queue) carry real logic and need one. Component and E2E testing stay out of scope — `pnpm lint && pnpm build` remains the check for those.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 2: Write the config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

// Only the pure modules are tested here: offer selection, license tokens, and
// the batch queue. Components and the extractors are covered by `pnpm lint &&
// pnpm build` plus scripts/cf-smoke.mjs, so there is no jsdom environment and
// no React plugin to keep the runner instant.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Add the script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
```

- [ ] **Step 4: Verify the runner starts**

Run: `pnpm test`
Expected: exits 0 with "No test files found" (no tests exist yet).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "test: add vitest for the pure logic modules"
```

---

### Task 2: Legal pages and footer links

Required before any affiliate program or ad network will approve the site, and the FTC requires the disclosure. Ships first because approvals take days.

**Files:**
- Create: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`
- Modify: `src/app/page.tsx:453-493`, `src/components/PlatformLanding.tsx:359-399`

**Interfaces:**
- Produces: routes `/privacy` and `/terms`, both statically exported.

- [ ] **Step 1: Write the privacy page**

Create `src/app/privacy/page.tsx`. Match the existing page shell (`app-bg`, `max-w-6xl`, `px-4 py-10 sm:py-16`) used by `src/app/page.tsx:213-220`.

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${siteConfig.name} handles your data: no accounts, no download logs, no cross-site tracking.`,
  alternates: { canonical: '/privacy' },
}

const UPDATED = '31 July 2026'

export default function Privacy() {
  return (
    <div className='app-bg relative min-h-[100dvh] overflow-clip'>
      <div className='relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16'>
        <h1 className='text-3xl font-bold tracking-tight text-white sm:text-4xl'>
          Privacy Policy
        </h1>
        <p className='mt-2 text-sm text-white/50'>Last updated {UPDATED}</p>

        <div className='mt-8 space-y-6 text-sm leading-relaxed text-white/70 md:text-base'>
          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>What we collect</h2>
            <p>
              No accounts, no sign-up, no email address. We do not log the links
              you paste or the files you download. Your Recent list is written to
              your own browser&rsquo;s local storage and never leaves the device.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Analytics</h2>
            <p>
              We use Cloudflare Web Analytics for page-view counts. It sets no
              cookies, builds no cross-site profile, and does not fingerprint
              your device. That is the only analytics on this site.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Sponsor links</h2>
            <p>
              After a successful download we may show one sponsor card. If you
              click it you are taken to that company&rsquo;s own site and we may
              earn a commission on a purchase, at no extra cost to you. We only
              see that a click happened, reported in aggregate by the advertiser.
              We never sell your data, and we run no popups, popunders, or
              redirects.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Payments</h2>
            <p>
              If you buy a Pro license, the payment is processed by Lemon
              Squeezy, who act as merchant of record. We never see your card
              details. Your license key is stored in your own browser.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Media handling</h2>
            <p>
              Links are resolved on demand and nothing you download is stored on
              our servers. Where a file is proxied, it is streamed through and
              discarded.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Contact</h2>
            <p>
              Questions: <a className='text-cyan-300 hover:text-cyan-200' href={siteConfig.author.url}>{siteConfig.author.name}</a>.
            </p>
          </section>
        </div>

        <Link href='/' className='mt-10 inline-block text-sm text-cyan-300 hover:text-cyan-200'>
          ← Back to the downloader
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the terms page**

Create `src/app/terms/page.tsx` with the same shell. Sections: the service is provided as-is with no warranty; the user is responsible for having the right to download any content they process; no commercial redistribution of downloaded media; Pro licenses are refundable within 14 days via Lemon Squeezy; the service may change or stop at any time. Metadata mirrors Step 1 with `canonical: '/terms'`.

- [ ] **Step 3: Verify the routes export**

Run: `pnpm build`
Expected: build succeeds and `out/privacy/index.html` and `out/terms/index.html` exist.

```bash
ls out/privacy/index.html out/terms/index.html
```

- [ ] **Step 4: Add footer links**

In `src/app/page.tsx` inside the `<footer>` at line 453, and in `src/components/PlatformLanding.tsx` inside the `<footer>` at line 359, add links matching the existing footer link styling:

```tsx
<Link href='/privacy' className='transition-colors hover:text-white/80'>
  Privacy
</Link>
<Link href='/terms' className='transition-colors hover:text-white/80'>
  Terms
</Link>
```

- [ ] **Step 5: Verify**

Run: `pnpm lint && pnpm build`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/privacy src/app/terms src/app/page.tsx src/components/PlatformLanding.tsx
git commit -m "feat(legal): add privacy policy and terms pages"
```

---

### Task 3: Cloudflare Web Analytics

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_CF_BEACON_TOKEN` build-time env var.
- Produces: nothing importable.

Note: Cloudflare Web Analytics supports page views only — it has **no custom-event API**. Sponsor-click attribution therefore comes from affiliate sub-id parameters (Task 5), and Pro sales from the Lemon Squeezy dashboard. Do not attempt to build a custom event pipeline.

- [ ] **Step 1: Add the beacon**

In `src/app/layout.tsx`, inside the `<body>` after the existing children, add:

```tsx
{process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ? (
  <script
    defer
    src='https://static.cloudflareinsights.com/beacon.min.js'
    data-cf-beacon={`{"token": "${process.env.NEXT_PUBLIC_CF_BEACON_TOKEN}"}`}
  />
) : null}
```

`NEXT_PUBLIC_*` is inlined at build time, so an unset token simply omits the tag — local builds stay beacon-free with no extra config.

- [ ] **Step 2: Verify it is absent without a token**

Run: `pnpm build && grep -c cloudflareinsights out/index.html || true`
Expected: `0`.

- [ ] **Step 3: Verify it appears with a token**

Run: `NEXT_PUBLIC_CF_BEACON_TOKEN=testtoken pnpm build && grep -c cloudflareinsights out/index.html`
Expected: `1`.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(analytics): add cookieless Cloudflare Web Analytics beacon"
```

---

### Task 4: Offer catalogue and selection logic

**Files:**
- Create: `src/config/offers.ts`, `src/lib/promo.ts`, `src/lib/promo.test.ts`

**Interfaces:**
- Produces:
  - `type OfferPlacement = 'post-result' | 'in-content'`
  - `interface Offer { id: string; headline: string; body: string; cta: string; href: string; weight: number; platforms: readonly string[] | 'all'; placements: readonly OfferPlacement[] }`
  - `const OFFERS: readonly Offer[]`
  - `selectOffer(offers: readonly Offer[], opts: { placement: OfferPlacement; platform?: string; seed: number }): Offer | null`
  - `offerHref(offer: Offer, placement: OfferPlacement, platform?: string): string`
  - `PROMO_DISMISS_KEY: string`, `isPromoDismissed(now: number): boolean`, `dismissPromo(now: number): void`, `PROMO_DISMISS_MS: number`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/promo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { offerHref, selectOffer } from './promo'
import type { Offer } from '@/config/offers'

const offer = (over: Partial<Offer> & { id: string }): Offer => ({
  headline: 'h',
  body: 'b',
  cta: 'c',
  href: 'https://example.com/x',
  weight: 1,
  platforms: 'all',
  placements: ['post-result'],
  ...over,
})

describe('selectOffer', () => {
  it('returns null when no offer matches the placement', () => {
    const offers = [offer({ id: 'a', placements: ['in-content'] })]
    expect(selectOffer(offers, { placement: 'post-result', seed: 0 })).toBeNull()
  })

  it('prefers a platform-specific offer over an all-platforms one', () => {
    const offers = [
      offer({ id: 'generic', platforms: 'all' }),
      offer({ id: 'tiktok-only', platforms: ['tiktok'] }),
    ]
    const picked = selectOffer(offers, {
      placement: 'post-result',
      platform: 'tiktok',
      seed: 0,
    })
    expect(picked?.id).toBe('tiktok-only')
  })

  it('falls back to all-platforms offers when nothing targets the platform', () => {
    const offers = [
      offer({ id: 'generic', platforms: 'all' }),
      offer({ id: 'tiktok-only', platforms: ['tiktok'] }),
    ]
    const picked = selectOffer(offers, {
      placement: 'post-result',
      platform: 'vimeo',
      seed: 0,
    })
    expect(picked?.id).toBe('generic')
  })

  it('is deterministic for a given seed', () => {
    const offers = [offer({ id: 'a' }), offer({ id: 'b' }), offer({ id: 'c' })]
    const opts = { placement: 'post-result' as const, seed: 7 }
    expect(selectOffer(offers, opts)?.id).toBe(selectOffer(offers, opts)?.id)
  })

  it('respects weight — a zero-weight offer is never picked', () => {
    const offers = [
      offer({ id: 'never', weight: 0 }),
      offer({ id: 'always', weight: 5 }),
    ]
    for (let seed = 0; seed < 50; seed++) {
      expect(selectOffer(offers, { placement: 'post-result', seed })?.id).toBe('always')
    }
  })

  it('ignores offers with a negative weight', () => {
    const offers = [offer({ id: 'bad', weight: -3 }), offer({ id: 'good', weight: 1 })]
    for (let seed = 0; seed < 20; seed++) {
      expect(selectOffer(offers, { placement: 'post-result', seed })?.id).toBe('good')
    }
  })
})

describe('offerHref', () => {
  it('appends a sub-id carrying placement and platform', () => {
    const href = offerHref(offer({ id: 'pcloud' }), 'post-result', 'tiktok')
    expect(href).toBe('https://example.com/x?subid=post-result_tiktok')
  })

  it('uses "none" for a missing platform', () => {
    const href = offerHref(offer({ id: 'pcloud' }), 'in-content')
    expect(href).toBe('https://example.com/x?subid=in-content_none')
  })

  it('preserves an existing query string', () => {
    const href = offerHref(
      offer({ id: 'x', href: 'https://example.com/x?ref=abc' }),
      'post-result',
      'youtube',
    )
    expect(href).toBe('https://example.com/x?ref=abc&subid=post-result_youtube')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./promo` or `@/config/offers`.

- [ ] **Step 3: Write the offer catalogue**

Create `src/config/offers.ts`:

```ts
/**
 * The commercial catalogue. This file is the entire process for adding,
 * reweighting, or killing an offer — no component changes, no deploy-time
 * config.
 *
 * `platforms` drives intent matching: a user who just pulled a TikTok is a
 * different buyer from one who just pulled a Vimeo lecture. A platform-specific
 * offer always beats an 'all' offer for that platform (see selectOffer).
 *
 * `weight` is relative within the matched set. Set it to 0 to bench an offer
 * without deleting its config.
 *
 * Attribution is via the `subid` query parameter appended by offerHref(), read
 * back in each affiliate network's own dashboard. Cloudflare Web Analytics has
 * no custom-event API and we deliberately run no other tracking.
 */

export type OfferPlacement = 'post-result' | 'in-content'

export interface Offer {
  /** Stable id. Also used as the React key and in the subid. */
  id: string
  headline: string
  body: string
  cta: string
  /** The affiliate destination, including whatever ref/aff parameter the network issues. */
  href: string
  /** Relative weight within the matched set. 0 benches the offer. */
  weight: number
  /** Platform slugs from detectPlatform(), or 'all'. */
  platforms: readonly string[] | 'all'
  placements: readonly OfferPlacement[]
}

/**
 * Placeholder hrefs marked TEMPLATE must be replaced with the real affiliate
 * link before the offer is given a non-zero weight. Weight 0 keeps an
 * un-approved program out of rotation without deleting its copy.
 */
export const OFFERS: readonly Offer[] = [
  {
    id: 'hitpaw-converter',
    headline: 'Convert and edit what you just saved',
    body: 'HitPaw Video Converter handles 1000+ formats, batch conversion, and quick edits on desktop.',
    cta: 'See HitPaw',
    href: 'TEMPLATE_HITPAW',
    weight: 0,
    platforms: ['tiktok', 'youtube', 'instagram', 'facebook', 'twitter'],
    placements: ['post-result', 'in-content'],
  },
  {
    id: 'pcloud-lifetime',
    headline: 'Somewhere to keep them',
    body: 'pCloud lifetime storage — pay once, keep your library off a phone that fills up.',
    cta: 'See pCloud',
    href: 'TEMPLATE_PCLOUD',
    weight: 0,
    platforms: 'all',
    placements: ['post-result', 'in-content'],
  },
  {
    id: 'epidemic-sound',
    headline: 'Music you can actually post with',
    body: 'Epidemic Sound licenses every track for social — no copyright strikes on your own uploads.',
    cta: 'See Epidemic Sound',
    href: 'TEMPLATE_EPIDEMIC',
    weight: 0,
    platforms: ['tiktok', 'instagram', 'threads', 'snapchat'],
    placements: ['post-result'],
  },
  {
    id: 'nordvpn',
    headline: 'Blocked where you are?',
    body: 'NordVPN unblocks region-locked video and keeps your connection private.',
    cta: 'See NordVPN',
    href: 'TEMPLATE_NORDVPN',
    weight: 0,
    platforms: 'all',
    placements: ['in-content'],
  },
]
```

- [ ] **Step 4: Write the selection logic**

Create `src/lib/promo.ts`:

```ts
import type { Offer, OfferPlacement } from '@/config/offers'

/** A dismissal suppresses the slot for a week, not forever. */
export const PROMO_DISMISS_MS = 7 * 24 * 60 * 60 * 1000
export const PROMO_DISMISS_KEY = 'smd:promo-dismissed-at'

function matchesPlacement(offer: Offer, placement: OfferPlacement): boolean {
  return offer.placements.includes(placement) && offer.weight > 0
}

function targetsPlatform(offer: Offer, platform: string | undefined): boolean {
  if (offer.platforms === 'all') return false
  if (!platform) return false
  return offer.platforms.includes(platform)
}

/**
 * Platform-specific offers beat generic ones outright rather than merely
 * outweighing them: a matched offer converts several times better, and a
 * blended pool would dilute that away.
 */
function candidatesFor(
  offers: readonly Offer[],
  placement: OfferPlacement,
  platform: string | undefined,
): Offer[] {
  const eligible = offers.filter((o) => matchesPlacement(o, placement))
  const targeted = eligible.filter((o) => targetsPlatform(o, platform))
  if (targeted.length > 0) return targeted
  return eligible.filter((o) => o.platforms === 'all')
}

/**
 * Weighted pick, deterministic in `seed` so a re-render cannot swap the card
 * out from under a user mid-read (and so the tests are not flaky).
 */
export function selectOffer(
  offers: readonly Offer[],
  opts: { placement: OfferPlacement; platform?: string; seed: number },
): Offer | null {
  const pool = candidatesFor(offers, opts.placement, opts.platform)
  if (pool.length === 0) return null

  const total = pool.reduce((sum, o) => sum + o.weight, 0)
  if (total <= 0) return null

  let cursor = Math.abs(opts.seed) % total
  for (const candidate of pool) {
    cursor -= candidate.weight
    if (cursor < 0) return candidate
  }
  return pool[pool.length - 1]
}

/**
 * Attribution rides on the affiliate network's own sub-id parameter, read back
 * in their dashboard. Nothing is reported to us, which is what keeps the
 * privacy claim true.
 */
export function offerHref(
  offer: Offer,
  placement: OfferPlacement,
  platform?: string,
): string {
  const subid = `${placement}_${platform || 'none'}`
  const separator = offer.href.includes('?') ? '&' : '?'
  return `${offer.href}${separator}subid=${subid}`
}

export function isPromoDismissed(now: number): boolean {
  try {
    const raw = window.localStorage.getItem(PROMO_DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return now - at < PROMO_DISMISS_MS
  } catch {
    // Storage blocked (private mode) — treat as not dismissed.
    return false
  }
}

export function dismissPromo(now: number): void {
  try {
    window.localStorage.setItem(PROMO_DISMISS_KEY, String(now))
  } catch {
    // Nothing to do; the slot simply reappears next session.
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/config/offers.ts src/lib/promo.ts src/lib/promo.test.ts
git commit -m "feat(promo): add the offer catalogue and weighted selection"
```

---

### Task 5: PromoSlot component and wire-ups

**Files:**
- Create: `src/components/PromoSlot.tsx`
- Modify: `src/components/DownloaderApp.tsx:2160`, `src/components/PlatformLanding.tsx:314`

**Interfaces:**
- Consumes: `selectOffer`, `offerHref`, `isPromoDismissed`, `dismissPromo` from `src/lib/promo.ts`; `OFFERS` from `src/config/offers.ts`; `useHydrated` from `src/lib/clientEnv.ts`.
- Produces: `<PromoSlot placement={...} platform={...} />`. In Task 11 it gains a Pro check; no call site changes then.

- [ ] **Step 1: Write the component**

Create `src/components/PromoSlot.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { OFFERS, type OfferPlacement } from '@/config/offers'
import { useHydrated } from '@/lib/clientEnv'
import { dismissPromo, isPromoDismissed, offerHref, selectOffer } from '@/lib/promo'

/**
 * The one surface on this site that carries commercial content, and therefore
 * the one place the rules live:
 *
 *  - never above the fold, never during a resolve, never during a download
 *    (the caller controls that by only mounting it once a result exists);
 *  - fixed min-height reserved before paint, so nothing below it moves — CLS
 *    from this component must stay at 0;
 *  - dismissible, and a dismissal sticks for a week;
 *  - no third-party script. This is a local <a> with rel="sponsored".
 *
 * Task 11 adds the Pro check here; every call site stays as-is.
 */
export function PromoSlot({
  placement,
  platform,
}: {
  placement: OfferPlacement
  platform?: string
}) {
  const hydrated = useHydrated()
  const [dismissed, setDismissed] = useState(false)

  // Seeded once per mount so a parent re-render cannot swap the card mid-read.
  const seed = useMemo(() => Math.floor(Math.random() * 1_000_000), [])
  const offer = useMemo(
    () => selectOffer(OFFERS, { placement, platform, seed }),
    [placement, platform, seed],
  )

  if (!offer) return null

  // The height is reserved unconditionally; only the contents are gated on
  // hydration and dismissal. Reserving after the checks would let the card
  // push the page down after paint, which is exactly the CLS we are avoiding.
  const suppressed = dismissed || (hydrated && isPromoDismissed(Date.now()))

  return (
    <div className='mt-4 min-h-[104px] sm:min-h-[92px]'>
      {!suppressed && (
        <div className='animate-section-in group relative overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-white'>{offer.headline}</p>
              <p className='mt-1 text-xs leading-relaxed text-white/60 md:text-sm'>
                {offer.body}
              </p>
            </div>
            <button
              type='button'
              aria-label='Dismiss this sponsor card'
              onClick={() => {
                dismissPromo(Date.now())
                setDismissed(true)
              }}
              className='shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-white/40 transition-colors hover:text-white/80'
            >
              Hide
            </button>
          </div>

          <div className='mt-3 flex items-center justify-between gap-3'>
            <a
              href={offerHref(offer, placement, platform)}
              target='_blank'
              rel='sponsored nofollow noopener noreferrer'
              className='rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition-transform duration-200 hover:-translate-y-0.5 hover:text-white active:scale-95'
            >
              {offer.cta}
            </a>
            <span className='text-[11px] text-white/35'>Sponsored</span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Mount it after the result card**

In `src/components/DownloaderApp.tsx`, add the import at the top with the other component imports:

```tsx
import { PromoSlot } from '@/components/PromoSlot'
```

Then at line 2160, immediately after the `</div>` that closes the result-card container and **before** the `{lightboxIndex !== null && ...}` block, insert:

```tsx
      {/* Sponsor card — only after a result exists, never while resolving or
          downloading, and always below the download controls. */}
      {state.videoMetadata && !state.loading && (
        <PromoSlot placement='post-result' platform={state.videoMetadata.platform} />
      )}
```

- [ ] **Step 3: Mount the in-content slot**

In `src/components/PlatformLanding.tsx`, add the same import, then insert between the `<section>` at line 314 and the one at line 323:

```tsx
        <section className='mt-16 sm:mt-24'>
          <PromoSlot placement='in-content' platform={platform.id} />
        </section>
```

If the `Platform` type's slug field is not named `id`, use whichever field holds the `detectPlatform()` slug (check `src/lib/platforms.ts`) — the value must match the strings used in `offers.ts`.

- [ ] **Step 4: Verify no offer renders yet**

Every offer ships at `weight: 0`, so `selectOffer` returns null and the slot renders nothing. That is deliberate — the component goes live before any affiliate approval exists.

Run: `pnpm lint && pnpm build`
Expected: both pass.

- [ ] **Step 5: Verify the slot with a temporary weight**

Temporarily set `weight: 1` on `pcloud-lifetime`, run `pnpm dev`, resolve any link, and confirm: the card appears below the download buttons; nothing above it moves when it appears; "Hide" removes it and it stays gone on reload. Then set the weight back to 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/PromoSlot.tsx src/components/DownloaderApp.tsx src/components/PlatformLanding.tsx
git commit -m "feat(promo): render the sponsor slot after results and in-content"
```

---

### Task 6: Donations, sponsor block, and the copy correction

The README and site currently claim "no ads, no tracking". After Task 5 that is false. Fixing it is part of shipping, not an afterthought.

**Files:**
- Create: `.github/FUNDING.yml`
- Modify: `README.md`, `src/app/page.tsx`, `src/components/PlatformLanding.tsx`

- [ ] **Step 1: Add FUNDING.yml**

Create `.github/FUNDING.yml`:

```yaml
github: [Vette1123]
ko_fi: REPLACE_WITH_KOFI_USERNAME
```

- [ ] **Step 2: Correct the README claims**

In `README.md`, replace the phrase `with **no ads, no tracking, and a multi-source fallback chain**` with:

```
with **no popups, no redirects, no tracking, and a multi-source fallback chain**
```

Then add, after the feature list:

```markdown
## Supporting the project

The site is free and stays free. It is paid for by one sponsor card that appears
after a download — no popups, no redirects, no interstitials, and no tracking of
what you download. You can remove that card for good with a
[Pro license](https://www.socialdownloader.space/pro), or support the work
directly through [GitHub Sponsors](https://github.com/sponsors/Vette1123).
```

- [ ] **Step 3: Search for any remaining "no ads" claim**

Run: `grep -rn "no ads\|No ads\|ad-free\|no tracking" README.md src/ --include=*.ts --include=*.tsx --include=*.md`
Expected: every hit is either corrected or is the Pro page describing what a license removes. Fix any survivor, including `src/config/site.ts` and `src/lib/homepageFaqs.ts` if they carry the claim.

- [ ] **Step 4: Add the donate link to both footers**

In `src/app/page.tsx` and `src/components/PlatformLanding.tsx` footers, next to the Privacy/Terms links from Task 2:

```tsx
<a
  href='https://github.com/sponsors/Vette1123'
  target='_blank'
  rel='noopener noreferrer'
  className='transition-colors hover:text-white/80'
>
  Sponsor
</a>
```

- [ ] **Step 5: Verify**

Run: `pnpm lint && pnpm build`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add .github/FUNDING.yml README.md src/app/page.tsx src/components/PlatformLanding.tsx
git commit -m "docs(monetization): correct the ad claims and add sponsor links"
```

---

### Task 7: Deploy phase 1

**Files:** none modified.

- [ ] **Step 1: Set the analytics token**

The Cloudflare Web Analytics token is a build-time `NEXT_PUBLIC_*` value, so it must be set as build env in the deploy workflow, not as a Worker var — the same reason `NEXT_PUBLIC_SITE_URL` is excluded from `wrangler.jsonc`.

- [ ] **Step 2: Deploy**

Run: `pnpm deploy`
Expected: build, `wrangler deploy`, and the IndexNow ping all succeed.

- [ ] **Step 3: Smoke the deployment**

Run: `node scripts/cf-smoke.mjs`
Expected: passes.

Then confirm by hand: `/privacy` and `/terms` load; the beacon script is present in the deployed HTML; no sponsor card renders anywhere (all weights are still 0).

- [ ] **Step 4: Run Lighthouse**

Mobile Lighthouse on the deployed home page and one platform page.
Expected: performance ≥ 96, CLS unchanged from the current baseline. The `_vercel/insights` best-practices 404 is local-only and expected to be absent here.

---

### Task 8: Extract the resolve pipeline

`DownloaderApp.tsx` is 2,188 lines and the resolve call is embedded in it. Batch (Task 14) must call the same pipeline without importing a component. Scope is strictly the extraction — no other cleanup of that file.

**Files:**
- Create: `src/lib/resolve.ts`
- Modify: `src/components/DownloaderApp.tsx`

**Interfaces:**
- Produces:
  - `interface ResolveOptions { type?: 'video' | 'audio'; quality?: 'hd' | 'sd'; format?: 'auto' | 'audio'; proToken?: string | null; signal?: AbortSignal }`
  - `interface ResolveResult { success: boolean; downloadUrl?: string; audioUrl?: string; metadata?: VideoMetadata; error?: string }`
  - `resolve(url: string, opts?: ResolveOptions): Promise<ResolveResult>`

- [ ] **Step 1: Find the current call**

Run: `grep -n "api/download" src/components/DownloaderApp.tsx`
Read every hit and its surrounding `fetch` block (there are calls near lines 558 and 614 — the initial resolve and the rendition re-pick).

- [ ] **Step 2: Write the module**

Create `src/lib/resolve.ts`, moving the `fetch('/api/download', ...)` body verbatim. Preserve the existing request shape exactly — `{ url, type, quality, format }` as read by `handleDownload` in `src/lib/apiRoutes.ts`.

```ts
import type { VideoMetadata } from '@/lib/types'

export interface ResolveOptions {
  type?: 'video' | 'audio'
  quality?: 'hd' | 'sd'
  format?: 'auto' | 'audio'
  /** Task 15: sent as X-Pro-Token so the Worker can prefer the fast resolver. */
  proToken?: string | null
  signal?: AbortSignal
}

export interface ResolveResult {
  success: boolean
  downloadUrl?: string
  audioUrl?: string
  metadata?: VideoMetadata
  error?: string
}

/**
 * The single client-side entry to /api/download, shared by the paste box and
 * the Pro batch queue. Extracted from DownloaderApp so the queue can call it
 * without importing a component.
 */
export async function resolve(
  url: string,
  opts: ResolveOptions = {},
): Promise<ResolveResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.proToken) headers['X-Pro-Token'] = opts.proToken

  const response = await fetch('/api/download', {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      url,
      type: opts.type ?? 'video',
      quality: opts.quality ?? 'hd',
      format: opts.format ?? 'auto',
    }),
  })

  return (await response.json()) as ResolveResult
}
```

Adjust the `VideoMetadata` import to whatever the metadata type is actually called in `src/lib/types.ts`.

- [ ] **Step 3: Replace both call sites**

In `DownloaderApp.tsx`, replace each inline `fetch('/api/download', ...)` with a `resolve(...)` call. The surrounding state handling, error mapping, and history writes stay exactly as they are.

- [ ] **Step 4: Verify behaviour is unchanged**

Run: `pnpm lint && pnpm build && pnpm dev`
Then by hand: resolve a TikTok link, a YouTube link, and an Instagram carousel; use the HD/SD re-pick and the MP3 toggle. All must behave exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/lib/resolve.ts src/components/DownloaderApp.tsx
git commit -m "refactor(resolve): extract the resolve pipeline out of DownloaderApp"
```

---

### Task 9: License token signing

**Files:**
- Create: `src/lib/licenseToken.ts`, `src/lib/licenseToken.test.ts`

**Interfaces:**
- Produces:
  - `interface TokenPayload { k: string; exp: number }`
  - `signToken(payload: TokenPayload, secret: string): Promise<string>`
  - `verifyToken(token: string, secret: string, now: number): Promise<TokenPayload | null>`
  - `TOKEN_TTL_MS: number`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/licenseToken.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { signToken, verifyToken } from './licenseToken'

const SECRET = 'test-secret-value'
const NOW = 1_800_000_000_000

describe('licenseToken', () => {
  it('round-trips a payload', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    const payload = await verifyToken(token, SECRET, NOW)
    expect(payload).toEqual({ k: 'abc123', exp: NOW + 1000 })
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    expect(await verifyToken(token, 'other-secret', NOW)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW - 1 }, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    const [, signature] = token.split('.')
    const forged = `${btoa(JSON.stringify({ k: 'hacked', exp: NOW + 1000 }))}.${signature}`
    expect(await verifyToken(forged, SECRET, NOW)).toBeNull()
  })

  it('rejects a malformed token', async () => {
    expect(await verifyToken('not-a-token', SECRET, NOW)).toBeNull()
    expect(await verifyToken('', SECRET, NOW)).toBeNull()
    expect(await verifyToken('a.b.c', SECRET, NOW)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./licenseToken`.

- [ ] **Step 3: Write the module**

Create `src/lib/licenseToken.ts`:

```ts
/**
 * A minimal signed token, used so that a Pro request can be trusted by the
 * Worker without a round trip to Lemon Squeezy on every resolve.
 *
 * Deliberately not a JWT: no library, no algorithm negotiation, no header to
 * get wrong. Payload plus HMAC-SHA256, base64url, verified with WebCrypto —
 * which is available in workerd, in Node 18+, and in the browser, so the same
 * code runs everywhere this project deploys.
 *
 * Verification is a single HMAC over ~60 bytes: microseconds, which matters
 * because it runs inside the 10 ms per-request CPU budget on the free plan.
 */

export interface TokenPayload {
  /** An opaque hash of the license key. The raw key never enters the token. */
  k: string
  /** Absolute expiry, epoch milliseconds. */
  exp: number
}

/** Tokens live a day; the client re-validates against Lemon Squeezy after that. */
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

const encoder = new TextEncoder()

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signToken(
  payload: TokenPayload,
  secret: string,
): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const key = await hmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`
}

export async function verifyToken(
  token: string,
  secret: string,
  now: number,
): Promise<TokenPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, signature] = parts
  if (!body || !signature) return null

  try {
    const key = await hmacKey(secret)
    // crypto.subtle.verify is constant-time, so this is not a comparison the
    // caller could time their way through.
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      encoder.encode(body),
    )
    if (!valid) return null

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(body)),
    ) as TokenPayload
    if (typeof payload?.k !== 'string' || typeof payload?.exp !== 'number') {
      return null
    }
    if (payload.exp <= now) return null
    return payload
  } catch {
    return null
  }
}

/** SHA-256 of the raw key, so the key itself is never stored or transmitted in a token. */
export async function hashKey(licenseKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(licenseKey))
  return base64UrlEncode(new Uint8Array(digest))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, 5 new tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/licenseToken.ts src/lib/licenseToken.test.ts
git commit -m "feat(license): add HMAC-signed Pro tokens"
```

---

### Task 10: The /api/license handler

**Files:**
- Create: `src/app/api/license/route.ts`
- Modify: `src/lib/apiRoutes.ts`

**Interfaces:**
- Consumes: `signToken`, `hashKey`, `TOKEN_TTL_MS` from `src/lib/licenseToken.ts`.
- Produces: `handleLicense(request: Request): Promise<Response>`; `POST /api/license` accepting `{ licenseKey: string; instanceId?: string }` and answering `{ success: true, token: string, instanceId: string, expiresAt: number }` or `{ success: false, error: string }`.

- [ ] **Step 1: Confirm the Lemon Squeezy contract**

Before writing the handler, confirm against the current Lemon Squeezy license API docs: the activate and validate endpoint paths, whether an `Authorization` header is required for them, the exact form-encoded field names, and the shape of the `activated`/`valid` response. Do not code this from memory — the field names are easy to get subtly wrong and the failure mode is a Pro user who paid and cannot activate.

- [ ] **Step 2: Write the handler**

Add to `src/lib/apiRoutes.ts`:

```ts
import { hashKey, signToken, TOKEN_TTL_MS } from './licenseToken'

const LEMON_API = 'https://api.lemonsqueezy.com/v1/licenses'

/**
 * Exchanges a Lemon Squeezy license key for a short-lived signed token.
 *
 * First call from a device activates (consuming one of the key's activation
 * slots, capped at 3 in the Lemon Squeezy product settings); later calls
 * validate the existing instance. Either way the answer is a token the resolve
 * handler can check locally, so the hot path never calls Lemon Squeezy.
 *
 * The Lemon Squeezy round trip is network I/O, which costs no CPU on Workers —
 * only the JSON parse is billed. There is deliberately no server-side cache:
 * the client holds its token for 24 hours, so this runs about once per user per
 * day.
 */
export async function handleLicense(request: Request): Promise<Response> {
  const secret = process.env.LICENSE_TOKEN_SECRET?.trim()
  if (!secret) {
    return Response.json(
      { success: false, error: 'Licensing is not configured on this deployment.' },
      { status: 503 },
    )
  }

  try {
    const { licenseKey, instanceId } = await request.json()
    if (!licenseKey || typeof licenseKey !== 'string') {
      return Response.json(
        { success: false, error: 'License key is required' },
        { status: 400 },
      )
    }

    const activating = !instanceId
    const endpoint = activating ? `${LEMON_API}/activate` : `${LEMON_API}/validate`
    const form = new URLSearchParams({ license_key: licenseKey })
    if (activating) {
      form.set('instance_name', 'socialdownloader-web')
    } else {
      form.set('instance_id', String(instanceId))
    }

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    })
    const data = await upstream.json()

    const ok = data?.activated === true || data?.valid === true
    if (!ok) {
      return Response.json(
        { success: false, error: data?.error || 'That license key was not accepted.' },
        { status: 400 },
      )
    }

    const expiresAt = Date.now() + TOKEN_TTL_MS
    const token = await signToken(
      { k: await hashKey(licenseKey), exp: expiresAt },
      secret,
    )

    return Response.json({
      success: true,
      token,
      instanceId: data?.instance?.id ?? instanceId ?? '',
      expiresAt,
    })
  } catch {
    return Response.json(
      { success: false, error: 'Could not reach the license server. Try again.' },
      { status: 502 },
    )
  }
}
```

- [ ] **Step 3: Register the route**

In the `API_ROUTES` table in `src/lib/apiRoutes.ts`, add:

```ts
  '/api/license': { method: 'POST', handler: handleLicense },
```

- [ ] **Step 4: Add the Next wrapper**

Create `src/app/api/license/route.ts`, matching the pattern in `src/app/api/download/route.ts`:

```ts
import { handleLicense } from '@/lib/apiRoutes'

// The implementation lives in src/lib/apiRoutes.ts, shared with the Cloudflare
// Worker entrypoint, which serves this path without initializing Next — see
// that file for why the CPU budget requires it.
export async function POST(request: Request) {
  return handleLicense(request)
}
```

- [ ] **Step 5: Verify the unconfigured path**

Run: `pnpm dev`, then:

```bash
curl -s -X POST http://localhost:3000/api/license -H 'Content-Type: application/json' -d '{"licenseKey":"x"}'
```

Expected without `LICENSE_TOKEN_SECRET` set: `{"success":false,"error":"Licensing is not configured on this deployment."}` with status 503.

- [ ] **Step 6: Verify the rejection path**

Set `LICENSE_TOKEN_SECRET=dev-secret` in `.env.local`, restart, and repeat the curl.
Expected: `success: false` with a Lemon Squeezy rejection message and status 400.

- [ ] **Step 7: Commit**

```bash
git add src/lib/apiRoutes.ts src/app/api/license
git commit -m "feat(license): exchange a license key for a signed Pro token"
```

---

### Task 11: Entitlements and the Pro-aware slot

**Files:**
- Create: `src/lib/entitlements.ts`
- Modify: `src/components/PromoSlot.tsx`

**Interfaces:**
- Produces:
  - `LICENSE_KEY_STORAGE = 'smd:license'`
  - `interface StoredLicense { key: string; instanceId: string; token: string; expiresAt: number }`
  - `readLicense(): StoredLicense | null`
  - `saveLicense(license: StoredLicense): void`
  - `clearLicense(): void`
  - `activateLicense(licenseKey: string): Promise<{ ok: true } | { ok: false; error: string }>`
  - `useTier(): 'free' | 'pro'`
  - `useProToken(): string | null`

- [ ] **Step 1: Write the module**

Create `src/lib/entitlements.ts`:

```tsx
'use client'

import { useSyncExternalStore } from 'react'

export const LICENSE_KEY_STORAGE = 'smd:license'

export interface StoredLicense {
  key: string
  instanceId: string
  token: string
  expiresAt: number
}

/**
 * Pro state lives entirely in localStorage. There is no account, so the key is
 * the credential and the browser is the only place it is kept.
 *
 * The ad-free half of Pro is enforced client-side and is trivially bypassable.
 * That is accepted: the honest buyer is the customer, and the entitlement that
 * actually costs us something (priority resolve) is checked server-side against
 * a signed token.
 */
export function readLicense(): StoredLicense | null {
  try {
    const raw = window.localStorage.getItem(LICENSE_KEY_STORAGE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredLicense
    if (typeof parsed?.token !== 'string' || typeof parsed?.expiresAt !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveLicense(license: StoredLicense): void {
  try {
    window.localStorage.setItem(LICENSE_KEY_STORAGE, JSON.stringify(license))
    notify()
  } catch {
    // Storage blocked — the purchase still works, it just will not persist.
  }
}

export function clearLicense(): void {
  try {
    window.localStorage.removeItem(LICENSE_KEY_STORAGE)
    notify()
  } catch {
    // Nothing to do.
  }
}

/**
 * Exchange a key for a token. Called on first entry and again whenever the
 * stored token has aged out, which is at most once a day.
 */
export async function activateLicense(
  licenseKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = readLicense()
  try {
    const response = await fetch('/api/license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey,
        instanceId: existing?.key === licenseKey ? existing.instanceId : undefined,
      }),
    })
    const data = await response.json()
    if (!data?.success) {
      return { ok: false, error: data?.error || 'That key was not accepted.' }
    }
    saveLicense({
      key: licenseKey,
      instanceId: data.instanceId,
      token: data.token,
      expiresAt: data.expiresAt,
    })
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach the license server. Try again.' }
  }
}

// A tiny store so every mounted component reacts to an activation without a
// reload. Mirrors the useSyncExternalStore pattern already used in clientEnv.ts.
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function currentTier(): 'free' | 'pro' {
  const license = readLicense()
  if (!license) return 'free'
  if (license.expiresAt <= Date.now()) return 'free'
  return 'pro'
}

const serverTier = (): 'free' | 'pro' => 'free'

/**
 * Free on the server and during hydration, so the markup never differs. A Pro
 * user sees the sponsor card for one frame at most, which is the correct
 * trade against a hydration mismatch.
 */
export function useTier(): 'free' | 'pro' {
  return useSyncExternalStore(subscribe, currentTier, serverTier)
}

function currentToken(): string | null {
  const license = readLicense()
  if (!license || license.expiresAt <= Date.now()) return null
  return license.token
}

const serverToken = (): string | null => null

export function useProToken(): string | null {
  return useSyncExternalStore(subscribe, currentToken, serverToken)
}
```

- [ ] **Step 2: Teach PromoSlot about Pro**

In `src/components/PromoSlot.tsx`, add the import and the check. No call site changes.

```tsx
import { useTier } from '@/lib/entitlements'
```

Then inside the component, after `const hydrated = useHydrated()`:

```tsx
  const tier = useTier()
```

and extend the suppression (keep it a single-level expression — no nested ternaries):

```tsx
  const suppressed =
    tier === 'pro' || dismissed || (hydrated && isPromoDismissed(Date.now()))
```

- [ ] **Step 3: Verify**

Run: `pnpm lint && pnpm build`
Expected: both pass.

Then in `pnpm dev`, with a temporary `weight: 1` on one offer: confirm the card renders; run `localStorage.setItem('smd:license', JSON.stringify({key:'x',instanceId:'y',token:'z',expiresAt:Date.now()+86400000}))` in the console; confirm the card disappears without a reload; run `localStorage.removeItem('smd:license')` and confirm it returns. Reset the weight to 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/entitlements.ts src/components/PromoSlot.tsx
git commit -m "feat(pro): add license entitlements and hide the sponsor card for Pro"
```

---

### Task 12: The /pro page

**Files:**
- Create: `src/app/pro/page.tsx`
- Modify: `src/app/page.tsx`, `src/components/PlatformLanding.tsx` (footer link)

**Interfaces:**
- Consumes: `activateLicense`, `useTier`, `clearLicense` from `src/lib/entitlements.ts`.

- [ ] **Step 1: Write the page**

Create `src/app/pro/page.tsx` using the shell from Task 2. It needs a client component for the key field, so put the form in a nested `'use client'` component in the same file or a sibling under `src/components/`.

Content requirements — the copy must be honest about each item, because overpromising here generates refunds:

- Price: **$9 one-time, lifetime**. No subscription, no renewal.
- "Batch — paste up to 20 links, resolve them as one queue."
- "No sponsor card — ever, on any page."
- "Priority resolve — your links go straight to the fastest resolver instead of walking the fallback chain." Do **not** write or imply that free users are throttled; they are not, and there is no rate limiter in this codebase.
- "Everything that is free today stays free. Pro only adds."
- A checkout button linking to the Lemon Squeezy hosted checkout URL.
- A key-entry field calling `activateLicense`, showing the returned error inline on failure and a success state on success.
- When `useTier() === 'pro'`, show the active state and a "Remove this license from this browser" button calling `clearLicense()`.

Metadata: `title: 'Pro'`, `alternates: { canonical: '/pro' }`.

- [ ] **Step 2: Add to the sitemap**

Check `src/app/sitemap.tsx`. If it enumerates routes explicitly, add `/pro`, `/privacy`, and `/terms`.

- [ ] **Step 3: Add the footer link**

Add a `Pro` link to both footers alongside the Task 2 and Task 6 links.

- [ ] **Step 4: Verify**

Run: `pnpm lint && pnpm build && ls out/pro/index.html`
Expected: passes and the file exists.

Then in `pnpm dev`, submit a junk key and confirm the inline error renders rather than a thrown exception.

- [ ] **Step 5: Commit**

```bash
git add src/app/pro src/app/sitemap.tsx src/app/page.tsx src/components/PlatformLanding.tsx
git commit -m "feat(pro): add the Pro page with checkout and key activation"
```

---

### Task 13: The batch queue

**Files:**
- Create: `src/lib/batchQueue.ts`, `src/lib/batchQueue.test.ts`

**Interfaces:**
- Produces:
  - `type BatchItemStatus = 'queued' | 'resolving' | 'done' | 'failed'`
  - `interface BatchItem { url: string; status: BatchItemStatus; result?: ResolveResult; error?: string }`
  - `MAX_BATCH_URLS = 20`, `BATCH_CONCURRENCY = 2`
  - `parseBatchInput(raw: string): string[]`
  - `runBatch(urls: string[], resolveFn: (url: string) => Promise<ResolveResult>, onUpdate: (items: BatchItem[]) => void): Promise<BatchItem[]>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/batchQueue.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { BATCH_CONCURRENCY, MAX_BATCH_URLS, parseBatchInput, runBatch } from './batchQueue'

describe('parseBatchInput', () => {
  it('splits on newlines and trims', () => {
    expect(parseBatchInput(' https://a.com \n\nhttps://b.com\n')).toEqual([
      'https://a.com',
      'https://b.com',
    ])
  })

  it('splits on spaces and commas too', () => {
    expect(parseBatchInput('https://a.com, https://b.com https://c.com')).toEqual([
      'https://a.com',
      'https://b.com',
      'https://c.com',
    ])
  })

  it('drops duplicates, keeping first order', () => {
    expect(parseBatchInput('https://a.com\nhttps://a.com\nhttps://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ])
  })

  it('caps at MAX_BATCH_URLS', () => {
    const many = Array.from({ length: 30 }, (_, i) => `https://a.com/${i}`).join('\n')
    expect(parseBatchInput(many)).toHaveLength(MAX_BATCH_URLS)
  })

  it('returns an empty array for empty input', () => {
    expect(parseBatchInput('   \n  ')).toEqual([])
  })
})

describe('runBatch', () => {
  it('resolves every url and marks them done', async () => {
    const resolveFn = vi.fn(async () => ({ success: true }))
    const items = await runBatch(['a', 'b', 'c'], resolveFn, () => {})
    expect(resolveFn).toHaveBeenCalledTimes(3)
    expect(items.map((i) => i.status)).toEqual(['done', 'done', 'done'])
  })

  it('marks a rejected url failed without stopping the rest', async () => {
    const resolveFn = vi.fn(async (url: string) => {
      if (url === 'b') throw new Error('boom')
      return { success: true }
    })
    const items = await runBatch(['a', 'b', 'c'], resolveFn, () => {})
    expect(items.map((i) => i.status)).toEqual(['done', 'failed', 'done'])
    expect(items[1].error).toBe('boom')
  })

  it('marks an unsuccessful result failed', async () => {
    const resolveFn = vi.fn(async () => ({ success: false, error: 'nope' }))
    const items = await runBatch(['a'], resolveFn, () => {})
    expect(items[0].status).toBe('failed')
    expect(items[0].error).toBe('nope')
  })

  it('never runs more than BATCH_CONCURRENCY at once', async () => {
    let running = 0
    let peak = 0
    const resolveFn = async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return { success: true }
    }
    await runBatch(['a', 'b', 'c', 'd', 'e', 'f'], resolveFn, () => {})
    expect(peak).toBeLessThanOrEqual(BATCH_CONCURRENCY)
  })

  it('reports progress through onUpdate', async () => {
    const onUpdate = vi.fn()
    await runBatch(['a', 'b'], async () => ({ success: true }), onUpdate)
    expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(4)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./batchQueue`.

- [ ] **Step 3: Write the module**

Create `src/lib/batchQueue.ts`:

```ts
import type { ResolveResult } from './resolve'

export const MAX_BATCH_URLS = 20

/**
 * Two at a time. The extractors are third-party and several of them rate-limit
 * by IP; a batch that hammers them just converts into a batch of failures.
 */
export const BATCH_CONCURRENCY = 2

export type BatchItemStatus = 'queued' | 'resolving' | 'done' | 'failed'

export interface BatchItem {
  url: string
  status: BatchItemStatus
  result?: ResolveResult
  error?: string
}

/**
 * Accepts however the user pasted them: one per line, comma-separated, or space
 * separated. Duplicates are dropped because resolving the same link twice is
 * always a mistake, and the list is capped so a paste of a thousand links
 * cannot be turned into a thousand extractor calls.
 */
export function parseBatchInput(raw: string): string[] {
  const parts = raw
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return [...new Set(parts)].slice(0, MAX_BATCH_URLS)
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to resolve'
}

/**
 * A bounded-concurrency queue. Workers pull from a shared cursor rather than
 * the list being chunked, so one slow link does not idle the other lane.
 */
export async function runBatch(
  urls: string[],
  resolveFn: (url: string) => Promise<ResolveResult>,
  onUpdate: (items: BatchItem[]) => void,
): Promise<BatchItem[]> {
  const items: BatchItem[] = urls.map((url) => ({ url, status: 'queued' }))
  let cursor = 0

  const publish = () => onUpdate(items.map((item) => ({ ...item })))

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      const item = items[index]
      item.status = 'resolving'
      publish()

      try {
        const result = await resolveFn(item.url)
        if (result?.success) {
          item.status = 'done'
          item.result = result
        } else {
          item.status = 'failed'
          item.error = result?.error || 'Failed to resolve'
        }
      } catch (error) {
        item.status = 'failed'
        item.error = messageOf(error)
      }
      publish()
    }
  }

  const lanes = Math.min(BATCH_CONCURRENCY, items.length)
  await Promise.all(Array.from({ length: lanes }, () => worker()))
  return items
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, 11 new tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/batchQueue.ts src/lib/batchQueue.test.ts
git commit -m "feat(batch): add the bounded-concurrency batch queue"
```

---

### Task 14: BatchPanel

**Files:**
- Create: `src/components/BatchPanel.tsx`
- Modify: `src/components/DownloaderApp.tsx`

**Interfaces:**
- Consumes: `parseBatchInput`, `runBatch`, `MAX_BATCH_URLS`, `BatchItem` from `src/lib/batchQueue.ts`; `resolve` from `src/lib/resolve.ts`; `useTier`, `useProToken` from `src/lib/entitlements.ts`.

Delivery is deliberately **not** "always ZIP". A client-side ZIP of twenty videos will exhaust memory on the phones this audience uses. Rules:

- Image and audio results are collected into a ZIP with the JSZip import already lazy-loaded at `src/components/DownloaderApp.tsx:1073`.
- Video results are saved one at a time as each finishes, reusing the existing per-item download path so tunnel downloads still bypass the Worker.

- [ ] **Step 1: Write the component**

Create `src/components/BatchPanel.tsx`. Requirements:

- Renders nothing when `useTier() !== 'pro'`. It is not a locked teaser — a free user never sees a disabled control, because the single-link flow is unchanged for them and a greyed-out panel is just clutter. The `/pro` page is where batch is advertised.
- A textarea, a count of parsed URLs against `MAX_BATCH_URLS`, and a Start button disabled while a run is in flight.
- Calls `runBatch(urls, (url) => resolve(url, { proToken }), setItems)`.
- Per-item rows showing `queued` / `resolving` / `done` / `failed` with the error text on failure.
- Uses the existing `.animate-section-in` class for row reveals. No motion height animations.
- A "Save all" action applying the ZIP/sequential split above.

- [ ] **Step 2: Mount it**

In `src/components/DownloaderApp.tsx`, mount `<BatchPanel />` directly below the paste bar (after the block ending near line 1420, before the Recent list). It self-hides for free users, so no conditional is needed at the call site.

- [ ] **Step 3: Verify the free path is untouched**

Run: `pnpm lint && pnpm build && pnpm dev`
With no license in localStorage: confirm the page is pixel-identical to before — no panel, no extra spacing, no shifted layout.

- [ ] **Step 4: Verify the Pro path**

Set a fake license in localStorage as in Task 11 Step 3. Confirm the panel appears, paste three real links, and confirm each resolves and the statuses advance. Note that a fake token means priority resolve is refused server-side (Task 15) and the request simply proceeds as a normal free resolve — that is the intended degradation.

- [ ] **Step 5: Commit**

```bash
git add src/components/BatchPanel.tsx src/components/DownloaderApp.tsx
git commit -m "feat(batch): add the Pro batch panel"
```

---

### Task 15: Priority resolve

**Files:**
- Modify: `src/lib/downloader.ts:217,254`, `src/lib/apiRoutes.ts`, `src/lib/resolve.ts` call sites in `src/components/DownloaderApp.tsx`

**Interfaces:**
- Consumes: `verifyToken` from `src/lib/licenseToken.ts`; `useProToken` from `src/lib/entitlements.ts`.
- Produces: `Downloader` accepts `priority?: boolean`.

The honest scope: there is no rate limiter or queue in this codebase, so "priority" means **resolver ordering only**. Today `cobaltInstances` puts the warm public instance first and the operator's own instances second, because a free fallback's cold start should not sit on the hot path. For a Pro request that trade flips — the private instances are not rate-limited and are worth the cold start.

- [ ] **Step 1: Add the option to Downloader**

In `src/lib/downloader.ts`, change the constructor at line 217:

```ts
  constructor(opts?: {
    quality?: 'hd' | 'sd'
    mode?: 'auto' | 'audio'
    priority?: boolean
  }) {
    this.videoQuality = opts?.quality === 'sd' ? 'sd' : 'hd'
    this.mode = opts?.mode === 'audio' ? 'audio' : 'auto'
    this.priority = opts?.priority === true
  }
```

Add the field beside the other private readonlys:

```ts
  // Pro requests try the operator's own instances first. See cobaltInstances.
  private readonly priority: boolean
```

- [ ] **Step 2: Reorder the instance chain**

`cobaltInstances` is currently a `private readonly` field initialized inline at line 254. Because the ordering now depends on a constructor argument, convert it to a getter so it is computed per instance, and extend the existing comment to explain the flip:

```ts
  // ... existing comment block, plus:
  //
  // A Pro request flips this order. The private instances are ours: not
  // rate-limited and not shared with the public internet, which is worth more
  // to someone who paid than the public instance's warm start is.
  private get cobaltInstances(): string[] {
    const publicInstance = 'https://co.otomir23.me/'
    const private_ = (process.env.COBALT_API_URL ?? '')
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    if (this.priority && private_.length > 0) {
      return [...private_, publicInstance]
    }
    return [publicInstance, ...private_]
  }
```

Verify no other code assigns to `cobaltInstances`:

```bash
grep -n "cobaltInstances" src/lib/downloader.ts
```

- [ ] **Step 3: Check the token in handleDownload**

In `src/lib/apiRoutes.ts`, inside `handleDownload`, before the `new Downloader(...)` call:

```ts
    // A Pro token only changes resolver ordering — nothing is gated behind it,
    // so an absent or stale token degrades silently to the normal free path.
    const priority = await isPriorityRequest(request)
```

and add the helper:

```ts
import { verifyToken } from './licenseToken'

async function isPriorityRequest(request: Request): Promise<boolean> {
  const token = request.headers.get('X-Pro-Token')
  const secret = process.env.LICENSE_TOKEN_SECRET?.trim()
  if (!token || !secret) return false
  return (await verifyToken(token, secret, Date.now())) !== null
}
```

Then pass it through:

```ts
    const downloader = new Downloader({ quality: preferredQuality, mode, priority })
```

The cache key must **not** include `priority` — the resolved payload is identical either way, and splitting the cache would halve its hit rate for no benefit.

- [ ] **Step 4: Send the token from the client**

In `src/components/DownloaderApp.tsx`, call `const proToken = useProToken()` alongside the other hooks and pass `proToken` in both `resolve()` calls.

- [ ] **Step 5: Verify**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: all pass.

Then confirm with `pnpm dev` that a resolve with no token still works, and that a resolve with a garbage `X-Pro-Token` also still works (silently, as a free resolve) rather than erroring:

```bash
curl -s -X POST http://localhost:3000/api/download \
  -H 'Content-Type: application/json' -H 'X-Pro-Token: garbage' \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' | head -c 200
```

Expected: a normal successful resolve payload.

- [ ] **Step 6: Commit**

```bash
git add src/lib/downloader.ts src/lib/apiRoutes.ts src/components/DownloaderApp.tsx
git commit -m "feat(pro): try the private resolvers first for licensed requests"
```

---

### Task 16: Deploy phase 2

**Files:** none modified.

- [ ] **Step 1: Set the secret**

```bash
wrangler secret put LICENSE_TOKEN_SECRET
```

Use a random 32+ byte value. Rotating it invalidates every issued token, which costs users one silent re-activation — acceptable, but not something to do casually.

- [ ] **Step 2: Deploy**

Run: `pnpm deploy`

- [ ] **Step 3: Smoke it**

Run: `node scripts/cf-smoke.mjs`

Then, with a **real** license key bought through the live Lemon Squeezy checkout (buy one yourself — a refund costs nothing and it is the only way to test the real path):

1. Enter the key on `/pro`; confirm activation succeeds.
2. Confirm the sponsor card disappears site-wide.
3. Confirm the batch panel appears and resolves a three-link batch.
4. Confirm a resolve carries `X-Pro-Token` in the network tab.
5. Open a private window and confirm the free experience is unchanged.

- [ ] **Step 4: Re-run Lighthouse**

Mobile, home page and one platform page.
Expected: still ≥ 96, CLS unchanged.

---

### Task 17: Display-ad scaffold

Not enabled. This task only ensures phase 3 is a switch rather than a rewrite.

**Files:**
- Modify: `src/components/PromoSlot.tsx`

- [ ] **Step 1: Add the flag branch**

In `PromoSlot`, when `process.env.NEXT_PUBLIC_ADS_ENABLED === '1'`, render the ad container in place of the offer card body — inside the same already-reserved height, so enabling it introduces no layout shift. Keep it a single-level condition; extract a small `AdUnit` component rather than nesting ternaries.

Leave the ad container empty with a comment naming what has to be filled in when a network is signed. Do not add a network script now — an unsigned network means an unknown script shape, and guessing at it would be dead code.

- [ ] **Step 2: Verify the flag is off by default**

Run: `pnpm build && grep -c "NEXT_PUBLIC_ADS_ENABLED" out/index.html || true`
Expected: `0` — the value is inlined at build time, so the unset branch is compiled out.

- [ ] **Step 3: Commit**

```bash
git add src/components/PromoSlot.tsx
git commit -m "feat(promo): scaffold the flag-gated display-ad slot"
```

---

### Task 18: Authenticated Instagram resolve for Pro

**Files:**
- Modify: `src/lib/downloader.ts:265-271`, `src/lib/apiRoutes.ts`, `README.md`, `src/app/pro/page.tsx`

**Interfaces:**
- Consumes: `isPriorityRequest` from Task 15's `src/lib/apiRoutes.ts`; the `Downloader` constructor options object from Task 15.
- Produces: `Downloader` accepts `authenticated?: boolean`.

**Why this is additive and not a paywall.** `IG_SESSIONID` is not set on the live deployment, so login-gated Instagram posts resolve for nobody today. Public reels, photos and carousels resolve without it and **must continue to, unchanged, for free users**. This task adds a capability that does not currently exist; it removes nothing. If the secret were already set in production this task would be a paywall and would not be in the plan.

- [ ] **Step 1: Gate the session cookie on the tier**

`src/lib/downloader.ts:271` currently reads the cookie unconditionally:

```ts
  private readonly instagramSessionId = process.env.IG_SESSIONID?.trim() || ''
```

Replace the field with a getter that returns it only for an authenticated request, and extend the existing comment block above it:

```ts
  // ... existing comment block, plus:
  //
  // Sending it is a Pro entitlement. The burner account is a scarce, flaggable
  // resource — Instagram bans accounts for automated access from datacenter
  // IPs — so it is spent on paying users rather than on all traffic. A free
  // request resolves exactly as it does today: public posts succeed, and
  // login-gated ones fail the same way they already do.
  private get instagramSessionId(): string {
    if (!this.authenticated) return ''
    return process.env.IG_SESSIONID?.trim() || ''
  }
```

Add the constructor option beside Task 15's `priority`:

```ts
  constructor(opts?: {
    quality?: 'hd' | 'sd'
    mode?: 'auto' | 'audio'
    priority?: boolean
    authenticated?: boolean
  }) {
    this.videoQuality = opts?.quality === 'sd' ? 'sd' : 'hd'
    this.mode = opts?.mode === 'audio' ? 'audio' : 'auto'
    this.priority = opts?.priority === true
    this.authenticated = opts?.authenticated === true
  }
```

and the field:

```ts
  // Pro requests may send the Instagram session cookie. See instagramSessionId.
  private readonly authenticated: boolean
```

Confirm nothing else assigns to the old field:

```bash
grep -n "instagramSessionId" src/lib/downloader.ts
```

Every remaining read must be a read, not an assignment — a getter cannot be assigned to, so a stale assignment is a build error rather than a silent bug.

- [ ] **Step 2: Pass the tier through, and split the cache key**

In `src/lib/apiRoutes.ts`, `handleDownload` already computes `const priority = await isPriorityRequest(request)` (Task 15). Reuse that same boolean — a valid Pro token grants both entitlements, so there is no second token check:

```ts
    const downloader = new Downloader({
      quality: preferredQuality,
      mode,
      priority,
      authenticated: priority,
    })
```

**The cache key must now include the tier.** Task 15 states the opposite for `priority`, and that remains correct for `priority` alone — resolver ordering does not change the payload. Authentication does: an authenticated resolve can return a login-gated post that an anonymous resolve cannot. Sharing one key across both tiers is a correctness and privacy defect in both directions — a free miss would be served to a Pro user, and a Pro user's login-gated result would be served to free users who are not entitled to it.

Change the key at `src/lib/apiRoutes.ts:101`:

```ts
    // `auth` is part of the key because an authenticated resolve can return a
    // login-gated post an anonymous one cannot. Ordering (priority) is NOT in
    // the key — it does not change the payload. See Task 15.
    const tier = priority ? 'auth' : 'anon'
    const cacheKey = `${tier}|${type}|${preferredQuality}|${mode}|${url}`
```

This halves the hit rate only for Instagram-authenticated traffic, which is a small minority of requests, and correctness outranks hit rate here.

- [ ] **Step 3: Verify the free path is byte-identical**

With `IG_SESSIONID` unset — the current production state — an authenticated and an anonymous resolve must behave identically, because the getter returns `''` either way.

Run `pnpm dev`, then:

```bash
curl -s -X POST http://localhost:3000/api/download \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.instagram.com/reel/C2DfBGSJKp1/"}' | head -c 300
```

Expected: a normal successful resolve for a public reel.

Then set `IG_SESSIONID` to a deliberately invalid value in `.env.local` and repeat. Expected: the same successful resolve for a public reel — the extractor must degrade gracefully on a bad or expired cookie rather than erroring, which is the behaviour the existing comment at `src/lib/downloader.ts:268` already claims. If it does not degrade gracefully, that is a pre-existing bug: report it, do not fix it in this task.

Finally confirm the cache split works — the same URL requested with and without a valid `X-Pro-Token` must produce two distinct `X-Cache: MISS` entries rather than the second returning `HIT`.

- [ ] **Step 4: Update the copy**

`README.md:171` currently reads:

```
| `IG_SESSIONID`        | Instagram session cookie — only needed to resolve Instagram stories.             |
```

Replace with:

```
| `IG_SESSIONID`        | Instagram session cookie from a burner account. Sent only for licensed (Pro) requests, to resolve login-gated posts. Public posts resolve without it. |
```

Add the entitlement to the `/pro` page's feature list (Task 12), worded so it does not overclaim: Instagram login-gated posts resolve **when** the operator has a working session cookie configured, and public Instagram content is free for everyone. Do not imply free users lost anything.

- [ ] **Step 5: Verify**

Run: `pnpm test && pnpm lint && pnpm cf:build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/downloader.ts src/lib/apiRoutes.ts README.md src/app/pro/page.tsx
git commit -m "feat(pro): send the Instagram session cookie for licensed requests"
```

---

## What the author must do (cannot be automated)

These require the site owner's identity, payment details, or a human signup. Everything else in this plan runs without them.

**Before Task 3:**
1. Cloudflare dashboard → Web Analytics → add `www.socialdownloader.space` → copy the beacon token. Set it as `NEXT_PUBLIC_CF_BEACON_TOKEN` in the deploy workflow's **build** env (not a Worker var — `NEXT_PUBLIC_*` is inlined at build time).

**Before Task 5 can earn anything (Task 4 ships with every weight at 0):**
2. Apply to the affiliate programs. Each one approves separately and some reject download-adjacent sites; `/privacy` and `/terms` must be live first, which is why Task 2 ships early. Suggested: Wondershare/HitPaw (via ShareASale or Impact), pCloud (their own program), Epidemic Sound (via Impact), NordVPN (via Impact or their own). For each approval, paste the issued link into the matching `href` in `src/config/offers.ts` and raise `weight` from 0 to 1.

**Before Task 6:**
3. Enable GitHub Sponsors on the account, and create a Ko-fi page if you want the second link. Put the Ko-fi username in `.github/FUNDING.yml`.

**Before Task 10:**
4. Create the Lemon Squeezy store and a product priced at **$9 one-time**, with **license keys enabled** and the activation limit set to **3**. Copy the hosted checkout URL into `src/app/pro/page.tsx`.
5. Complete Lemon Squeezy payout onboarding (PayPal or Wise). If your country is not supported, say so and the plan switches to Polar — only `handleLicense` changes.

**Before Task 16:**
6. Run `wrangler secret put LICENSE_TOKEN_SECRET` with a random 32+ byte value.

**Before Task 18 can unlock anything:**
7. Run `wrangler secret put IG_SESSIONID` with the `sessionid` cookie from a **burner** Instagram account. Task 18 ships working without it — the entitlement simply resolves nothing extra until the secret exists. Instagram flags accounts for automated access from datacenter IPs, so never use a personal account, and expect to re-grab the cookie when login-gated downloads start failing.

**Credentials I need from you, and how to hand them over.** Put them in `.env.local` (already gitignored — verify with `git check-ignore .env.local`), not in chat, and never in a file that gets committed:

```
NEXT_PUBLIC_CF_BEACON_TOKEN=
LICENSE_TOKEN_SECRET=
```

The affiliate links go directly into `src/config/offers.ts`, which **is** committed — that is correct and expected, since an affiliate link is a public URL, not a secret.

I do not need and will not ask for: your Lemon Squeezy account password, your Cloudflare account credentials, your payout details, or any affiliate network login. The Lemon Squeezy license endpoints used in Task 10 require no API key.

## Self-review notes

Three corrections were made against the spec while writing this plan; the spec has been updated to match:

1. **No Upstash caching of license validations.** The spec proposed a 24-hour Redis cache. It is unnecessary — the client holds its token for 24 hours, so validation runs about once per user per day, and the Lemon Squeezy call is network I/O that costs no Worker CPU. Removed rather than built.
2. **No custom analytics events.** Cloudflare Web Analytics has page views only. Sponsor-click attribution comes from the `subid` parameter read in each affiliate dashboard, and Pro conversion from the Lemon Squeezy dashboard. The spec's "track slot impressions and clicks" was not implementable as written.
3. **Priority resolve is resolver ordering, not queue-jumping.** There is no rate limiter in this codebase. The `/pro` copy is constrained accordingly in Task 12.
