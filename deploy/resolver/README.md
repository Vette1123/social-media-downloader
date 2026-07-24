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

## Deploy to Hugging Face Spaces (free, no credit card)

1. **Sign up / log in** at huggingface.co. The free CPU Basic tier (2 vCPU,
   16 GB) needs **no card**.
2. **New → Space.** Name it e.g. `media-resolver`. **SDK: Docker**, template
   **Blank**, hardware **CPU basic (free)**. Create.
3. **Add the files.** In the Space → **Files → Add file → Upload files**, upload
   all four from this folder: `Dockerfile`, `app.py`, `requirements.txt`,
   `README.md` (this file — its frontmatter sets the port). Commit.
   *(Git alternative: `git clone https://huggingface.co/spaces/<user>/media-resolver`,
   copy the four files in, `git push`.)*
4. The Space builds automatically (Docker, ~3–5 min). When it's **Running**, the
   public URL is `https://<user>-media-resolver.hf.space` (also under
   **Settings → Embed this Space**). The service auto-detects this URL at
   runtime, so no `BASE_URL` needs setting.
5. **Settings → Variables and secrets → New secret:** add `RESOLVER_SECRET` = any
   long random string (keeps tunnel tokens valid across restarts). Optional:
   `RESOLVER_API_KEY`, `RESOLVER_COOKIES` (see below).

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

Free Spaces pause after ~48 h idle. To keep it hot, ping it with a free scheduler
— **cron-job.org** (also no card):

- Create a cron job: `GET https://<user>-media-resolver.hf.space/health` every
  30 minutes.

## Sources behind a login / anti-bot check

Some sources gate downloads behind cookies + a browser check. To handle them:

1. Export a `cookies.txt` (Netscape format) with a browser extension such as
   "Get cookies.txt LOCALLY" while logged in on that site.
2. Paste the file **contents** into the `RESOLVER_COOKIES` secret on the Space
   and it redeploys.

The image already installs `curl_cffi`, so the service impersonates a real
browser's TLS fingerprint automatically. Cookies expire, so refresh them if a
previously-working source starts failing.

## Alt host: Render (needs a card now)

The repo also ships a `render.yaml` blueprint. Render's free tier recently began
requiring a `$1` card authorization, so Hugging Face above is the no-card path;
use Render only if you already have a card on file.

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
