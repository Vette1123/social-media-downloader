# The homepage was public, and Google still called it a login wall

## What

Set up the Google OAuth consent screen (Google Auth Platform branding) for the
sign-in this repo already implements: app name, support email, the three
non-sensitive scopes (`openid email profile`, exactly the claims
`src/lib/auth/routes.ts` reads), home/privacy/terms URLs, authorised domain, and
a web OAuth client whose redirect URIs cover every origin the site answers on —
`www`, apex, `localhost:3000` (`next dev`) and `localhost:8787` (`wrangler dev`),
because `callbackUrl()` in `src/lib/auth/google.ts` builds the redirect from the
request's own origin.

Uploading a logo put the app into brand verification, which then failed twice
with two errors: the domain was not registered to us, and "your homepage is
behind a login page".

No repo code changed. The work was configuration, one DNS record, and a logo PNG.

## Mistakes

**Declared the second error a phantom on residential evidence.** The homepage was
fetched as Googlebot, as Chrome, and with an empty User-Agent — 200, full 145 KB,
real headings, `/privacy` and `/terms` in the footer — and that was written up as
"nothing is wrong on your side, the flag is stale". Every one of those requests
left the same residential IP. The conclusion was right about the *page* and wrong
about the *cause*, and it nearly closed the case on "resubmit and hope".

**Toggling Bot Fight Mode appeared to do nothing, which almost buried the fix.**
With the setting off, the homepage still carried
`/cdn-cgi/challenge-platform/scripts/jsd/main.js`. That reads as "not the cause"
and would have sent us back to arguing with Google. It was the cache: every
response came back `CF-Cache-Status: HIT`, the injection is baked into the stored
HTML at the moment Cloudflare builds it, and a stored response keeps it forever.
A random query string did not bust it either — the zone's cache key ignores the
query. **Purging is what made the change observable**, and it is not clear even
now how much of the fix was the toggle versus the purge of long-stale HTML.

**Trusted a cache-busting trick instead of reading the cache header.** Two
successive probes were issued as `curl` then `curl -I` against the same URL, so
the GET populated the cache and the HEAD reported the HIT it had just created.
The header was being read off the wrong request.

**Assumed a transparent PNG would stay transparent.** The consent-screen logo was
rendered with a rounded tile and real alpha, and Google's preview showed white
corners anyway. The file was fine — `sharp` reported `hasAlpha true`, corner pixel
`RGBA 0,0,0,0`. Google's uploader flattens alpha onto white. Chasing "make it
transparent" a second time would have produced the same white corners.

**Assumed the API token in `.env` was a Cloudflare admin token.** It writes DNS
(the verification TXT went in over the API without trouble) and returns
`10000 Authentication error` for both `/bot_management` and `/purge_cache`. Scope
was discovered one failed call at a time.

## What worked

Probing the site across the whole matrix a reviewer might use — `HEAD`, `http://`,
apex, empty UA, the policy pages — and, crucially, one fetch from *outside* this
network (a datacenter-origin fetch rendered the real page). That is what proved
the page itself was innocent and pushed the search toward edge state.

Reading `CF-Cache-Status` on the same request as the body, once the earlier probe
was recognised as self-poisoning.

Rendering the logo from SVG through `sharp` rather than `ImageResponse`: the
in-repo `next/og` path bakes an opaque backdrop behind the rounded tile, and the
art (gradient stops, glyph path, ratios) copies cleanly out of
`src/lib/appIcon.tsx`. When transparency turned out to be unwinnable, the fix was
to remove the corners — a full-bleed square tile with the glyph at the maskable
safe ratio has nothing to flatten, and survives Google's circular crop.

Verifying the DNS TXT against `1.1.1.1` before pressing Verify, instead of
trusting the API's success response.

## Rules

- A page proven public from one IP is proven public from *one IP*. Reachability
  complaints from a remote reviewer need a fetch that does not originate here.
- Never conclude a Cloudflare setting had no effect until the cache is purged.
  Edge-injected markup lives in the cached response, and on this zone a query
  string does not bust it.
- Read `CF-Cache-Status` from the same request whose body you are inspecting.
  A follow-up `curl -I` reports the cache entry the previous call created.
- Consent-screen logos: full-bleed square, no alpha in the design. Google
  flattens transparency to white.
- Skip the logo entirely unless it is wanted: non-sensitive scopes publish to
  Production with no review, and the logo is the only thing that summons brand
  verification.
- Redirect URIs must cover every origin the site answers on, because the callback
  URL is derived from the request origin — `www`, apex, and both dev ports.
- The Cloudflare token in `.env` is DNS-scoped. Bot management and cache purge
  are dashboard-only.

Related: [[2026-08-15-google-oauth-project-move.md]], and the Bot Fight Mode
diagnosis in the Creem webhook work — same setting, second victim.
