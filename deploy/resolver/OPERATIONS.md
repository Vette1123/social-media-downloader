# Resolver operations runbook

How the self-hosted media resolver is deployed, wired, and kept healthy. Nothing
secret lives here — only env-var **names** and procedure. Real values (tokens,
proxy creds, cookies) live only in the host/Vercel env, never in the repo.

## Architecture at a glance

```
browser ──▶ Vercel app ──▶ (public Cobalt, then) self-hosted resolver ──▶ source
   ▲                              │  writes live URL
   │                              ▼
   └───────── media stream ◀── resolver /t  (streams DIRECT from CDN)

discovery:  resolver ──SET live URL──▶ Upstash Redis ──GET──▶ Vercel app
```

- The app tries the public Cobalt instance first, then any configured
  `COBALT_API_URL`, then the **discovered** resolver URL (from Upstash).
- The resolver **extracts** through a proxy (small), then **streams the media
  direct from the CDN** (large) — proxy bytes are spent only if the CDN itself
  rejects the box. See `perf(resolver): stream media direct…` commit.

## Hosting

- **Back4app Containers** — free, no card, Docker from this repo
  (`deploy/resolver`, port 8080). RAM 256 MB.
- ⚠️ **Free tier hands out a TEMPORARY public URL** that rotates on
  restart/redeploy, with **no API to read the current one**. This is why the
  self-registration loop exists (below) — the app never needs the URL hand-fed.
- Long-term card-free upgrade path if rotation/limits get annoying: **Oracle
  Cloud Always-Free VM** (real always-on host, served region → no proxy needed).
  Koyeb's free tier closed (acquired by Mistral, 2026); Render/Railway/Fly now
  want a card.

## Environment variables

Set on the **resolver host** (Back4app):

| Var | Purpose |
|-----|---------|
| `RESOLVER_SECRET` | HMAC key for tunnel tokens (keep stable across restarts) |
| `RESOLVER_PROXY` | `http://USER:PASS@HOST:PORT` — egress proxy in a **served region** for geo-gated extraction |
| `RESOLVER_COOKIES` | optional `cookies.txt` contents for login-walled sources (or `RESOLVER_COOKIES_URL` → raw URL) |
| `RESOLVER_API_KEY` | optional; if set, callers must send `Authorization: Api-Key <key>` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | shared store for self-registration |
| `REGISTRY_KEY` | optional; discovery key name (default `resolver_url`) |

Set on **Vercel** (the app):

| Var | Purpose |
|-----|---------|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | **same values** as the resolver — lets the app discover the live URL |
| `REGISTRY_KEY` | optional; must match the resolver if overridden |
| `COBALT_API_URL` | optional now; discovery replaces the need to hand-set it |
| `COBALT_API_KEY` | only if `RESOLVER_API_KEY` is set on the resolver |

## Self-registration loop (why URL rotation no longer hurts)

1. On every `/health` ping and every resolve, the resolver derives its **current
   public URL** from the forwarded host and `SET`s it into Upstash with a 15-min
   TTL (`_register` in `app.py`).
2. The app reads that key (`discoverResolverBase` in `src/lib/downloader.ts`,
   60 s in-process cache) and tries the discovered URL ahead of its fallback list.
3. Back4app rotates the URL → next ping re-registers → app follows. No env churn.
4. If the resolver dies, the key expires (TTL) → app stops handing out a dead URL.

## Keep-warm cron (prevents rotation)

Free instances sleep when idle; the wake-up restart is what rotates the URL.
A scheduler ping keeps it hot **and** refreshes the discovery key.

- **cron-job.org** (free, no card): `GET https://<current-host>/health` every
  **5 min** (`*/5 * * * *`).
- ⚠️ This URL is **hardcoded** in the cron — the one spot that still needs a
  manual update if the host rotates. Keeping it warm prevents rotation, so in
  steady state it stays put; only a code redeploy forces a new URL.

## Health check

`GET /health` → `{"status":"ok","auth":<cookies loaded>,"proxy":<proxy set>,"registry":<store wired>}`

- `?geo=1` reports the effective egress region through the proxy (diagnose
  geo-restriction / dead proxy).
- `auth:true` = a cookie jar loaded. `proxy:true` = `RESOLVER_PROXY` set.
  `registry:true` = Upstash env present.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `/health` → 404 | host URL rotated | grab new URL from Back4app dashboard; update the cron URL |
| resolve → `fetch.empty`, detail `Redirection detected` | egress IP geo-blocked by the source | point `RESOLVER_PROXY` at a **served** region |
| detail `CONNECT tunnel failed, response 402` / `ProxyError` | proxy quota exhausted (free tiers are metered, ~1 GB/mo) | refresh proxy creds; the direct-stream fix keeps quota from draining on downloads |
| `geo` → `JSONDecodeError` | proxy up but the lookup host returned non-JSON | benign; proxy is connecting |
| login-walled source fails | needs cookies | set `RESOLVER_COOKIES` (Netscape `cookies.txt`); refresh when expired |
| app not using resolver | discovery key missing/stale | check `registry:true` on `/health`; confirm same Upstash env on both sides; check the key in Upstash Data Browser |

Add `{"debug":true}` to a resolve POST body to surface the last extractor error
in the response `detail` field.

## Secrets hygiene

- Never commit proxy creds, cookies, Upstash tokens, or `RESOLVER_SECRET`.
- Rotate any credential that has ever been pasted into a chat/log.
- Cookies expire — refresh `RESOLVER_COOKIES` when a previously-working
  login-walled source starts failing.
