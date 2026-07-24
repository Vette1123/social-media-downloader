---
title: Media Resolver
emoji: 🔗
colorFrom: gray
colorTo: blue
sdk: docker
app_port: 8080
pinned: false
---

# Generic media resolver

A tiny self-hosted service that resolves a link server-side and **tunnels** the
bytes through its own host, so the media streams from any IP. It speaks the same
API shape as the public tunnel service, so the main app uses it as a drop-in
fallback via the `COBALT_API_URL` env var — no app code changes needed.

The main app already routes any link it doesn't have a bespoke extractor for to
this path, so once this is deployed and wired, those links resolve on the live
(deployed) site with no local tooling required.

## Deploy to Koyeb (free, no credit card)

1. **Sign up / log in** at koyeb.com — use **GitHub**. The Hobby plan needs
   **no card** (it may ask a human-check, not a card).
2. **Create Web Service → GitHub**, pick the repo. Grant Koyeb access if asked.
3. Configure the build:
   - Branch: `main`
   - **Work directory:** `deploy/resolver`  ← critical (the service lives here)
   - Builder: **Dockerfile** (auto-detected)
   - Instance: **Free**
   - **Exposed port: 8080** (matches the image default)
4. **Environment variables:** add `RESOLVER_SECRET` = any long random string
   (keeps tunnel tokens valid across restarts). Optional: `RESOLVER_API_KEY`,
   `RESOLVER_COOKIES` (see below).
5. **Deploy.** When it's healthy, copy the public URL
   `https://<name>-<org>.koyeb.app`. Koyeb usually injects this automatically; if
   playback URLs come back pointing at localhost, add an env var
   `BASE_URL = https://<name>-<org>.koyeb.app` and redeploy.

## Wire it to the app

On the Vercel project → **Settings → Environment Variables**:

- `COBALT_API_URL` = the Space URL from step 4 (e.g.
  `https://<user>-media-resolver.hf.space`).
  This var accepts a comma/space-separated list, so it stacks with any existing
  value.
- If you set `RESOLVER_API_KEY` on the Space, also set `COBALT_API_KEY` to the
  same value here.

Redeploy the Vercel app. Paste a link on the site — it resolves through the
resolver.

## Keep it warm (optional)

Free instances may sleep after idle. To keep it hot, ping it with a free
scheduler — **cron-job.org** (also no card):

- Create a cron job: `GET https://<name>-<org>.koyeb.app/health` every 10 min.

## Sources behind a login / anti-bot check

Some sources gate downloads behind cookies + a browser check. To handle them:

1. Export a `cookies.txt` (Netscape format) with a browser extension such as
   "Get cookies.txt LOCALLY" while logged in on that site.
2. Paste the file **contents** into the `RESOLVER_COOKIES` secret on the Space
   and it redeploys.

The image already installs `curl_cffi`, so the service impersonates a real
browser's TLS fingerprint automatically. Cookies expire, so refresh them if a
previously-working source starts failing.

## Alt hosts

- **Back4app Containers** — also no card (GitHub import, Docker). Only 256 MB
  RAM, so heavier remuxes may struggle; fine for most progressive links.
- **Render** — ships a `render.yaml` blueprint, but its free tier now requires a
  `$1` card authorization. Use only if you already have a card on file.
- **Hugging Face Spaces** — Docker Spaces now require a paid PRO plan (only
  Static Spaces stay free), so it no longer works as a no-card option.

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
