# Recent list flashed in on every refresh

## What
- A returning visitor's Recent list lives in localStorage, so the static HTML never has it. It appeared at hydration (pushing everything under the paste bar down on a phone where JS lands after first paint) and replayed its 220 ms `animate-section-in` fade on every refresh.
- Fix: `src/lib/recentReserve.ts`. The client stores the collapsed list's rendered height as `width:height`; a head script sets `html[data-recent]` + `--recent-h` before paint; a `[data-recent-slot]` of that height sits in the static HTML until hydration, and the real list replaces it in the same render. A list already stored at boot no longer fades in.

## Mistakes
- `pnpm cls` reported 0 for the returning visitor all along, and the earlier audit took that as proof. Headless Chrome on a cached reload hydrates before the first paint, so the shift the user sees on a phone never happened in the audit. A 0 from a CLS counter is "not seen here", not "not there".
- Checked live first: headless Chrome gets Cloudflare's security-verification page on production, so a `--url` run measures the challenge. Audit the local build.

## What worked
- Asserting the mechanism instead of the symptom: the audit now fails when the reserved height (`--recent-h` under `data-recent`) differs from the rendered list by more than 1 px. Stripping the head script from `out/index.html` turned 4 runs red (0 px vs 384 px); restoring it, green.

## Rules
- Anything rendered from localStorage needs a pre-paint reserve (head script + CSS-gated slot), same as the supporter mark. Measure it client-side; never guess heights from row counts.
- An entrance animation is for something that arrives during the visit, not for content that was there at boot.
