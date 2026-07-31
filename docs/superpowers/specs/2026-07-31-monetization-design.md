# Monetization Design

Date: 2026-07-31
Status: approved, pending implementation plan

## Goal

Turn an existing, finished, free product into a revenue-generating one without
damaging the properties that make it good: no login, no popups, no redirects, no
tracking, no paywall on anything that is free today, and a Lighthouse mobile
score that stays at 96.

Current traffic is under 5,000 visits/month, which rules out display advertising
as a primary source. The design therefore optimizes revenue *per visitor* rather
than impressions, and is built so the same surfaces earn more as SEO compounds.

## Revenue stack

Five layers, ordered by expected earnings per visitor at current traffic.

| # | Layer | Mechanism | Estimate at 5k visits/mo | Phase |
|---|-------|-----------|--------------------------|-------|
| 1 | Affiliate offers | Native sponsor card, intent-matched to the platform | $20–80/mo | 1 |
| 2 | Pro license | One-time key: batch downloads, no sponsor card, priority resolve | $50–200/mo | 2 |
| 3 | Donations | GitHub Sponsors + Ko-fi, footer and README | $0–20/mo | 1 |
| 4 | Display ads | Same slots, third-party network, behind a flag | $5–25/mo | 3 |
| 5 | Paid resolver API | RapidAPI listing of the extraction endpoint | negligible now | later |

Realistic combined total at current traffic is $50–200/month, scaling close to
linearly with organic growth.

### Why affiliate outranks display here

Downloader traffic skews to low-CPM geographies; display RPM for this niche is
roughly $1–3. A single conversion on a video-converter or VPN offer pays $30–100.
The same pixels earn roughly an order of magnitude more when filled with a
matched offer instead of a banner.

### Display-ad reality check

Google AdSense is likely to reject this site. Their policies target sites that
facilitate downloading copyrighted media, and YouTube downloaders are denied
routinely. Networks that accept the niche — Adsterra, Monetag, HilltopAds — make
their margin on popunders, which are excluded by the UX contract below; their
banner-only inventory pays $0.50–2 RPM.

Display ads are therefore phase 3, behind a build flag, and are treated as a
supplement rather than a plan.

## UX contract

These are enforced in code by a single component, not by convention.

```
Tool page (/, /tiktok-downloader, and the other 10 landing pages)
  ├─ hero + paste box ............... never carries a promo
  ├─ result card .................... never carries a promo
  ├─ download buttons ............... never carries a promo
  ├─ ▸ PromoSlot ................... renders AFTER a successful result, below the buttons
  ├─ platform grid / features ....... untouched
  ├─ ▸ PromoSlot (in-content) ...... one unit, far below the fold
  └─ footer ......................... donate link, /pro link
```

Rules:

1. The slot reserves its final height before paint. No layout shift.
2. The slot never renders while resolving or while a download is in flight.
3. The slot never renders for a Pro user.
4. The slot is dismissible; a dismissal suppresses it for 7 days via
   `localStorage`.
5. Phase 1 ships zero third-party JavaScript. The card is a local `<a>` element
   with `rel="sponsored nofollow"` and a plain `<img>` served from `/public`.
6. No popunders, no redirects, no interstitials, no countdown gates, ever.
7. Nothing that is free on 2026-07-31 ever moves behind the license.

## Architecture

### Phase 1 — sponsor slot, donations, foundations

**`src/config/offers.ts`** — typed offer catalogue. Each entry declares an id,
headline, one-line body, CTA label, destination URL, an optional local image, a
rotation weight, and a `platforms` array used for intent matching. Editing this
file is the entire process for adding, reweighting, or killing an offer.

Intent matching, in expected-EPC order:

- **Wondershare / HitPaw / Movavi** — desktop converter and editor products.
  Recurring commissions around 30%. Strongest intent overlap with a user who has
  just downloaded a video.
- **pCloud lifetime** — answers "where do these files live". ~20% on high-ticket
  lifetime plans.
- **Epidemic Sound / Envato Elements** — the TikTok and Instagram half of the
  audience are creators. $25–30 per signup.
- **NordVPN or Surfshark** — highest raw payout, weakest intent match. Ship one,
  measure, cut if EPC disappoints.

Start with three or four. Measure. Delete the losers.

**`src/components/PromoSlot.tsx`** — the single rendering surface for all
commercial content. Takes a placement (`post-result` or `in-content`) and an
optional platform. Selects an offer by weighted rotation from the matching
subset, or renders the Pro upsell, or renders nothing. Owns every rule in the UX
contract above. Visual language is inherited from the existing
`src/components/RafiqPromoCard.tsx` so the card reads as part of the app rather
than as an embed.

Because phase 3 swaps the card's body for a third-party ad unit without touching
any call site, the slot is built once and refilled later.

**Wire-ups** — post-result inside `src/components/DownloaderApp.tsx`;
in-content inside `src/components/PlatformLanding.tsx`, which covers all 11
landing pages in one edit; a donate link and a `/pro` link in the footer.

**`src/app/privacy/page.tsx` and `src/app/terms/page.tsx`** — static pages. The
FTC requires an affiliate disclosure, and every affiliate program and ad network
requires both pages to exist before approval. A one-line disclosure also sits
inside the sponsor card itself.

**Analytics** — Cloudflare Web Analytics. Free, cookieless, requires no consent
banner, and does not contradict the privacy positioning.

It reports page views only; it has no custom-event API. Rather than build an
event pipeline — which would mean either a Worker request per click against the
100k/day cap, or a third-party tracker that breaks the privacy claim —
attribution rides on infrastructure that already exists: each offer URL carries a
`subid` parameter encoding placement and platform, read back in the affiliate
network's own dashboard, and Pro conversions are read from the Lemon Squeezy
dashboard. Nothing about a click is reported to us, which is what keeps the
privacy claim literally true.

**Copy correction** — the README and site currently claim "no ads, no tracking".
That becomes false on ship. Replacement wording: *"No popups, no redirects, no
tracking. One sponsor card, after your download."* Being explicit about this is a
differentiator against the sites this tool competes with.

**Donations** — `.github/FUNDING.yml` plus GitHub Sponsors and Ko-fi links in the
footer and README. One hour of work, permanently on.

### Phase 2 — Pro license

Pro adds capability. It removes nothing.

What a license unlocks:

1. **Batch** — paste up to 20 links, resolve them as a queue, save the results.
2. **No sponsor card** — `PromoSlot` returns null for the whole session.
3. **Priority resolve** — routed straight to the premium resolver instead of
   walking the fallback chain from the top.

   There is no rate limiter or request queue in the codebase today, so "priority"
   means resolver ordering only, not queue-jumping. It is honest but modest, and
   the `/pro` copy must describe it as "goes straight to the fastest resolver"
   rather than implying free users are throttled. If a free-tier rate limit is
   ever added, Pro exemption becomes the second half of this entitlement.

**Payment: Lemon Squeezy.** Merchant of record, so EU VAT and global sales tax
are handled rather than becoming the author's problem. Its license-key API is
mature, and payouts reach more countries via PayPal and Wise than Polar's
Stripe-Connect-only model. Polar is the fallback if Lemon Squeezy onboarding
fails.

**Price: $9 one-time, lifetime**, with a $6 early-bird for the first 100 keys.
An audience selected for wanting a free, no-login tool converts far better on an
impulse one-time purchase than on a subscription, and one-time sales carry no
churn, dunning, or cancellation support burden.

**No account, ever.** The license key *is* the credential. Entered once on
`/pro`, stored in `localStorage`. Lemon Squeezy's per-key activation limit is set
to 3 devices, which supplies device capping for free.

**Validation path** — `src/app/api/license/route.ts`, running in the Worker:

1. Client posts the key. Worker calls the Lemon Squeezy validate/activate
   endpoint. Network wait costs no CPU on Workers; only the JSON parse does.
2. On success the Worker returns an HMAC-SHA256 token over `{keyHash, exp}`,
   signed with the `LICENSE_TOKEN_SECRET` Worker secret via WebCrypto.
   Sub-millisecond to verify.
3. The client stores the token and sends it as `X-Pro-Token` on resolve requests.
   The Worker verifies the signature locally — no Lemon Squeezy call on the hot
   path, well inside the 10 ms CPU budget.
4. The client revalidates every 24 hours.

There is deliberately **no server-side cache** of validations. An earlier draft
put them in Upstash with a 24-hour TTL; that is redundant, because the client
already holds its token for 24 hours, so a validation runs roughly once per user
per day and the upstream call costs I/O rather than CPU.

Ad-free is enforced client-side and is trivially bypassable. That is acceptable:
the honest buyer is the customer, and the server-side entitlement (priority
resolve) is the part that is actually protected.

**`src/lib/entitlements.ts`** — a `useTier()` hook reading the cached token.
Defaults to free, never blocks or delays render, never gates an existing feature.

**Batch implementation** — `src/lib/batchQueue.ts` plus
`src/components/BatchPanel.tsx`. The queue runs at concurrency 2 to stay inside
the resolver's tolerance, reusing the existing resolve pipeline.

Delivery is deliberately not "always ZIP". Videos are large and a client-side ZIP
of 20 of them will exhaust memory on the mobile devices this audience uses.
Rules: images and audio are collected into a ZIP via the JSZip import already
lazy-loaded at `src/components/DownloaderApp.tsx:1073`; video results are saved
individually as each one finishes, reusing the existing per-item download path so
tunnel downloads still bypass the Worker.

**Supporting refactor** — the resolve pipeline is currently embedded in
`DownloaderApp.tsx`, which stands at 2,188 lines. Batch needs to call it without
importing a component. Extract it to `src/lib/resolve.ts` with the existing
behaviour unchanged. This is scoped strictly to what batch requires; no unrelated
cleanup of that file is in scope.

**`src/app/pro/page.tsx`** — pricing, an honest list of what a key unlocks, the
key-entry field, and the checkout link. Static-export compatible.

**Upsell placement** — the highest-intent moment in the entire product is the
instant a download succeeds. `PromoSlot` rotates the Pro upsell into the
post-result position alongside the affiliate offers, at a weight tuned on
measured data.

### Phase 3 — display ads, gated

A third-party unit fills the same `PromoSlot` positions, enabled by
`NEXT_PUBLIC_ADS_ENABLED`. The script loads lazily, after the result renders,
inside the already-reserved height so CLS stays at zero. Not enabled until
traffic justifies it and a network that accepts the niche without popunders is
signed. Off by default.

## Ship order

1. Legal pages, affiliate disclosure, Cloudflare Web Analytics — ~2h
2. `offers.ts`, `PromoSlot`, both wire-ups — ~1 day
3. Donations, `.github/FUNDING.yml`, README sponsor block — ~1h
4. Copy honesty correction, deploy phase 1 — ~1h
5. Extract `src/lib/resolve.ts` — ~half day
6. License endpoint, `entitlements.ts`, `/pro` page — ~1 day
7. `BatchPanel` and `batchQueue` — ~1 day
8. Deploy phase 2, then tune offer weights on real click data
9. Phase 3 only when the data says so

Phase 1 is live in roughly two days. Phase 2 follows within a week.

## Open items requiring the author's input

Neither blocks the start of implementation; both must be settled before phase 2
deploys.

1. **Lemon Squeezy payout eligibility** for the author's country. If onboarding
   fails, substitute Polar and keep the rest of the design unchanged — the
   license endpoint is the only file that differs.
2. **Affiliate program approvals.** Each network approves individually and some
   reject download-adjacent sites. `offers.ts` ships with whichever programs
   approve; the component does not care which.

## Success criteria

- Lighthouse mobile stays at 96 or better after every phase.
- Cumulative Layout Shift attributable to `PromoSlot` is 0.
- No promo renders above the fold, during resolve, or during a download.
- Every feature that is free on 2026-07-31 is still free and still login-free.
- Sponsor-card click-through and Pro conversion are both measurable within a week
  of phase 1 shipping.
