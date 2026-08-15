# The bot protection that could not be told who the good bots were

## What

Ported the sibling movies project's Cloudflare WAF setup into `scripts/cf-setup.mjs`
as a new `waf` step (`pnpm cf:waf`), and applied it to the zone.

Free-plan **Bot Fight Mode is now off**, along with JavaScript Detections and
Cloudflare's managed `robots.txt`. In its place, in the WAF phases where an
allowlist actually applies:

- **block** — extensions this site never serves (`.php`, `.env`, `.sql`, …);
- **skip** — `cf.client.bot` plus named unfurlers, search crawlers and the AI
  crawlers `src/app/robots.tsx` already invites;
- **managed_challenge** — scripted user agents (`python-requests`, `curl/`,
  `axios/`, empty UA), excluding `/api/billing/*`;
- **rate limit** — 30 req/10s per IP on `/api/download`, the only endpoint that
  spends an extractor call.

Plus TLS: min 1.2, Full (Strict), HSTS 6 months without preload.

Verified live: Googlebot gets `200` on `/sitemap.xml`, `facebookexternalhit` gets
`200` on a page, `/wp-login.php` gets `403`, a `curl/` UA gets a challenge, a
browser POST to `/api/download` reaches the Worker, `/api/billing/bmc` with a
`curl/` UA reaches the Worker (`401` from our own HMAC check, not a challenge),
`robots.txt` is ours including the `Sitemap:` line, no
`/cdn-cgi/challenge-platform` script in the homepage HTML, and
`Strict-Transport-Security: max-age=15552000; includeSubDomains` on the response.

## Mistakes

**The first verification run was made by a client my own new rule challenges.**
`curl -s https://…/robots.txt` came back as Cloudflare's `Just a moment...` page
— correct behaviour, since `curl/` is in the challenge list — and the follow-up
check, `grep -c challenge-platform` on the homepage, returned `1`. That number
was about to be written down as "JS Detections is still injecting its script,
purge the cache". It was the challenge page's own script, on a challenge page
that only existed because of the rule. **Re-run every post-WAF check with a
browser user agent before reading anything into the result** — with a real UA the
count is `0` and the homepage is clean.

**The token's scopes were assumed from memory and were wrong in both directions.**
The note in memory said the `.env` token is DNS-only. It also carries
`Zone Settings: Edit`, so the first run applied TLS and HSTS to production while
silently skipping the four steps that were the point of the exercise — and it
does *not* carry `Cache Purge`, which the step's own closing advice tells the
operator to do. A half-applied run is the normal outcome here, which is why each
group is wrapped in its own `task()` and reports which scope it wanted.

**Two of the ported rules were nearly ported verbatim, and both were wrong for
this project.** `ai_bots_protection: 'block'` is right for a movies site and
backwards here: `robots.tsx` allows GPTBot, PerplexityBot and ClaudeBot by name
and there is an `/llms.txt`, so edge enforcement would have overruled both
silently. The cache rule and its `Vary`-strip companion would have pinned a
static export's HTML at the edge for six hours with nothing in the deploy to
purge it — and no purge scope on the token to do it by hand.

**The challenge rule was one careless list away from breaking our own CI.** An
empty user agent is challenged, and `scripts/indexnow.mjs` fetches the deployed
sitemap after every deploy — a script that swallows its own failures, so a break
there is silent and costs indexing. Checked rather than assumed: Node's global
`fetch` sends `User-Agent: node`, and the script sets its own UA anyway. Both
pass. The near miss is the lesson: any UA rule has to be read against every
first-party client that talks to production, not just against the scrapers.

**The challenge list stopped real users for three hours, and nothing said so.**
`okhttp` went into the scripted-UA list because it appears on every "block these
scrapers" list on the internet. Three hours later the zone's firewall events had
58 challenges on `/api/download` from **19 distinct residential IPs across
Canada, Brazil and France**, about three requests each — the shape of people
downloading a couple of videos, not of a scraper. okhttp is the default HTTP
client on Android, so anything wrapping this site in an app arrives with it.

Nothing else could have shown this. The Worker never ran, so `wrangler tail` was
empty; the asset store never answered, so there was no log line; and the users
saw a Cloudflare challenge page, which nobody reports as a bug. The site looked
perfectly healthy from every angle available. **A user-agent list written from
the scraper's point of view will stop users, and the only witness is the zone's
own event log** — which is why `pnpm cf:health` now exists and why it is the
required step after touching those lists.

## What worked

- **Reading the sibling repo's script before writing anything** — it carries two
  months of measurements this zone would otherwise have had to repeat, most of
  all *why* Bot Fight Mode has to be off rather than merely allowlisted.
- **Adding a step to `cf-setup.mjs` instead of a second script.** Token loading,
  the API envelope unwrapping, zone lookup and the output vocabulary already
  existed; the port is rules and one step function.
- **Per-group isolation with a recorded failure list.** Each group needs a
  different token permission, so one missing scope must never stop the rest.
- **Tagging every managed rule with `[smd-waf]`** and replacing only those on
  write — re-running is idempotent and a hand-made rule in the dashboard
  survives.
- **Probing the live zone as each kind of client** — crawler, unfurler, scanner,
  scripted client, browser, webhook sender — instead of trusting the API
  readback. The readback proves a rule exists; only the probe proves it does what
  it says.

- **Reading the events back before calling it done.** The same query that found
  the okhttp problem also proved the change worked: `socialdownloader-indexnow`,
  `BMC-HTTPS-ROBOT`, `GoogleAgent-URLContext` and a bare `Google` agent were all
  being challenged by `source: botFight` in the hours *before* the switch, and
  none after it. The IndexNow one is the quiet cost — it fetches the deployed
  sitemap after every deploy and swallows its own failures, so it had been
  failing silently for as long as Bot Fight Mode had been on.
- **Distinguishing a live rule from a dead one in the health output.** Events
  from `botFight` cannot recur now that it is off, so they print dimmed as
  history instead of failing the check — otherwise the check would stay red for
  24 hours after every fix and be ignored by the second day.

## Rules

- Free-plan Bot Fight Mode runs outside the Ruleset Engine. No `skip` rule
  reaches it. If crawlers must be allowlisted, it has to be **off**, with the
  defence re-expressed as WAF rules.
- After changing bot rules, re-test with a **browser** user agent. A challenged
  probe answers about the rule, not about the site.
- Read the current value of a Cloudflare setting before porting a sibling
  project's value for it. `ai_bots_protection` differs per project on purpose.
- Send a new or rarely-used field (here `ai_bots_protection`) in its own API
  call, so its rejection cannot take a critical field's value down with it.
- Before adding a user-agent rule, list the first-party clients that hit
  production — CI scripts, post-deploy pings, webhook senders — and check what UA
  each one actually sends.
- Edge-caching HTML is a deploy problem, not a cache problem. Do not enable it
  without a purge in the deploy path.
- **Run `pnpm cf:health` after every WAF change, and again a day later.** A rule
  that stops the wrong client produces no error anywhere else in this stack.
- Judge a user-agent by the traffic it actually carries here — count the distinct
  client IPs. Dozens of residential addresses in several countries are users; a
  handful of datacenter ones are a scraper. The name of the HTTP library says
  nothing about who is holding it.

Related: [[2026-08-15-google-oauth-brand-verification.md]] and
`docs/buymeacoffee-setup.md`, both of which describe symptoms this change
removes at the source.
