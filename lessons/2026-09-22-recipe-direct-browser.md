# The link the browser had to fetch itself

**Date:** 2026-09-22
**Scope:** `src/lib/siteRules.ts`, `src/lib/pageScrape.ts`, `src/lib/downloader.ts`,
`src/lib/apiRoutes.ts`, `src/components/DownloaderApp.tsx`, `src/components/BatchPanel.tsx`

## What

Production still answered 422 (block message) for a hard-walled host after the
referer work shipped, while every local probe passed. Three commits:

- `af57d35` — recipe-built URLs now hand off to the browser: `resolveByRule`
  gained `hcap` (the height the page states about itself), probes that height
  first, and returns it unverified when every probe from our egress comes back
  as a page (a walled host answers media HEAD with the same wall). The result
  carries `directBrowser`, `directSaveUrl` exposes it as `directVideoUrl`, and
  both the progress fetch and the hidden-iframe handoff send
  `referrerPolicy: 'no-referrer'` — measured: that host serves the full file
  with attachment headers to a referrer-less request and a 642 KB stub to ours.
- `9ff8775` — `relay()` now retries a 429 (honoring retry-after, capped at 5s)
  or a 403 challenge once more with `x-no-cache`, three attempts total; walls
  and other statuses stay single-attempt.
- `db7610a` — optional `JINA_API_KEY`: the reader meters anonymous callers by
  address and Workers egress exhausts the shared quota within minutes; a key
  moves calls onto the key's quota.

A throwaway diagnostic Worker (rounds 5–11 in
`%TEMP%\opencode\diag\`) replayed the exact production chain from CF egress:
watch/embed direct = the 369-byte stub (detected, < 2048), media HEADs = 200
text/html ('page'), other free relays dead from CF (codetabs timeout,
allorigins 403, corsproxy 401), reader the only live page path.

## Mistakes

- **Diagnosed a "code bug" that was a stale dev server.** `directVideoUrl`
  missing locally traced to a `pnpm dev` process started before the edits;
  killing and restarting it produced the expected payload shape immediately.
- **Local success proved nothing about the recipe path.** From a residential
  IP the watch page isn't walled, so extraction wins and `fromRule` stays
  false — the debug log showed `fromRule: false` with a perfectly good URL.
  Only a walled egress exercises the rule; local e2e cannot verify this fix.
- **The diagnostic burned the quota it was measuring.** Rounds of r.jina.ai
  calls from the diag Worker exhausted the reader's anonymous budget for our
  egress; subsequent rounds measured 429/403 and read as "jina is broken"
  when the measurement itself was the cause. Production traffic is one call
  per resolve.
- **Prod curl without a browser header set hit the zone's bot challenge**
  (managed challenge HTML) — looked like the API breaking until retried with
  UA/Accept/Origin/Referer.
- Nested ternary in the first retry-wait draft (style rule bans them) —
  extracted `retryWaitSeconds`.
- New relay test asserted 3 calls without stubbing `DEPLOY_TARGET` — got 9
  (three relays × three attempts); scoped it to the reader.
- Comment dates written as 2026-09-23 (tomorrow); corrected to the measured
  day.

## What worked

- **Same call, two egresses.** The reader fetch identical from local and from
  CF isolated the variable: 200/8211 bytes with fid+height from residential,
  429 from CF — caller-metering, not target-blocking. One round, definitive.
- Replaying the production call chain on a throwaway Worker before touching
  product code: every link of the chain (wall detection, relay, probes, hcap)
  confirmed or falsified in one deploy.
- Checking that failures are never cached (`worthCaching` runs only on the
  success payload) before blaming a stale edge entry for the repeated 422.
- Bounded retry honoring the service's own `retry-after` (capped) rather than
  inventing a backoff schedule.

## Rules

- **A local pass on an unwalled host never proves the walled path.** When the
  fix only runs after a wall, verify from a walled egress or don't claim it.
- **Never hammer a free relay from diagnostics.** Its quota is production
  capacity; every burn shows up as a later 422.
- **Same request, two egresses, one diff** — the cheapest way to tell
  "service blocks us" from "service blocks our target".
- **Probe production with browser-shaped headers** or you are measuring the
  zone's bot layer, not your Worker.
- **Suspect the process before the code** when a behavior change doesn't
  show: restart the dev server, then re-measure.
