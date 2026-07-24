# Generic media resolver

A tiny self-hosted service that resolves a link server-side and **tunnels** the
bytes through its own host, so the media streams from any IP. It speaks the same
API shape as the public tunnel service, so the main app uses it as a drop-in
fallback via the `COBALT_API_URL` env var — no app code changes needed.

The main app already routes any link it doesn't have a bespoke extractor for to
this path, so once this is deployed and wired, those links resolve on the live
(deployed) site with no local tooling required.

## Deploy to Render (free, no credit card)

1. **Sign up** at render.com with GitHub or email. The free tier needs **no
   card**.
2. **New + → Blueprint → pick this repo → Apply.** Render reads `render.yaml`
   and builds `deploy/resolver` as a Docker web service on the **Free** plan.
   (Manual alternative: New + → Web Service → this repo → set **Root Directory**
   to `deploy/resolver`, Runtime **Docker**, Plan **Free**.)
3. When the build finishes, copy the service URL, e.g.
   `https://media-resolver-xxxx.onrender.com`.

## Wire it to the app

On the Vercel project → **Settings → Environment Variables**:

- `COBALT_API_URL` = the Render URL from step 3 (e.g.
  `https://media-resolver-xxxx.onrender.com`).
  This var accepts a comma/space-separated list, so it stacks with any existing
  value.
- If you set `RESOLVER_API_KEY` on Render, also set `COBALT_API_KEY` to the same
  value here.

Redeploy the Vercel app. Paste a link on the site — it resolves through the
resolver.

## Keep it warm (avoid cold starts)

Render's free web service sleeps after ~15 min idle (~30–60s to wake). Prevent
that with a free pinger — **cron-job.org** (also no card):

- Create a cron job: `GET https://media-resolver-xxxx.onrender.com/health`
  every 10 minutes.

## Sources behind a login / anti-bot check

Some sources gate downloads behind cookies + a browser check. To handle them:

1. Export a `cookies.txt` (Netscape format) with a browser extension such as
   "Get cookies.txt LOCALLY" while logged in on that site.
2. Paste the file **contents** into the `RESOLVER_COOKIES` env var on Render and
   redeploy.

The image already installs `curl_cffi`, so the service impersonates a real
browser's TLS fingerprint automatically. Cookies expire, so refresh them if a
previously-working source starts failing.

## Local test

```bash
cd deploy/resolver
docker build -t media-resolver .
docker run -p 8080:8080 -e BASE_URL=http://localhost:8080 media-resolver
# resolve:
curl -s -X POST http://localhost:8080/ -H 'content-type: application/json' \
  -d '{"url":"<link>"}'
# then GET the returned .url to stream it
```
