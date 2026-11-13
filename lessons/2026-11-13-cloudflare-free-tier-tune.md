# Cloudflare free tier: global audit and zone tune

## What
Audited every zone setting and the free-tier product catalogue against this
app. Applied, as code (`pnpm cf:tune`, `stepTune` in `scripts/cf-setup.mjs`):
email obfuscation OFF and server-side excludes OFF (both rewrite our static HTML
at the edge), DNSSEC ON (DS record added at Namecheap), and five free alert
emails: abuse report, Trust & Safety block, L7 DDoS, Universal SSL, origin errors.

Already on and left alone: Smart Tiered Cache, HTTP/3 + 0-RTT, Early Hints,
Brotli, HSTS, TLS 1.2 floor, strict SSL, managed WAF rules.

## Mistakes
- The first Chrome profile was signed in to a different Cloudflare account
  (reely.space only). Time went to dashboard 404s before checking the account
  switcher. The API token in `.env` is the authority for which account owns the
  zone; check the dashboard login against it first.
- The alert POST failed with 17007 "Invalid policy condition": not every alert
  type accepts a `zones` filter, and the API does not say which. The step now
  tries zone-scoped, then account-wide.

## What worked
- Asking for token scopes (Zone Settings, DNS, Notifications) instead of
  clicking the dashboard: the change is now re-runnable and reviewable.

## Rules
- Nothing at the edge may rewrite the HTML (obfuscation, SSE, Rocket Loader,
  Zaraz, auto-minify): hydration and the CI SEO head check depend on the bytes.
- No HTML edge-cache rule while the token cannot purge: a cached page can
  outlive the deploy that deleted its chunks.
- Turning DNSSEC OFF: remove the DS record at Namecheap FIRST, wait a day, then
  disable in Cloudflare — the other order takes the domain offline.
