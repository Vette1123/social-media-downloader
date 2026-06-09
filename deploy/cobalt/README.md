# Self-hosted cobalt on Fly.io

A private [cobalt](https://github.com/imputnet/cobalt) API instance that extracts
and **tunnels** media. The Vercel app calls it server-side; because cobalt
tunnels the bytes through its own server, the URLs it returns play from any IP
(which is why this fixes TikTok where tikwm/datacenter extraction fails).

## Prerequisites

- A [Fly.io](https://fly.io) account (a payment card is required even on the
  free allowance).
- `flyctl` installed:
  - Windows (PowerShell): `iwr https://fly.io/install.ps1 -useb | iex`
  - macOS/Linux: `curl -L https://fly.io/install.sh | sh`

## Deploy (run these from this `deploy/cobalt/` folder)

These commands are interactive / need your Fly auth, so run them yourself
(prefix with `!` in Claude Code to run inline, or use your own terminal):

```bash
fly auth login

# 1. Pick a UNIQUE app name (fly.dev URLs are global). Replace everywhere below.
#    Edit fly.toml: set `app` AND `API_URL` to https://<your-name>.fly.dev/

# 2. Register the app from the existing config (don't deploy yet).
fly launch --copy-config --no-deploy --name <your-name> --region fra

# 3. Deploy the cobalt image.
fly deploy

# 4. Pin to exactly ONE machine. cobalt tunnel URLs are signed by the machine
#    that created them, so a 2nd machine would serve some tunnels a 404/403.
fly scale count 1
```

Verify it's up (should return JSON with `cobalt` version info):

```bash
curl https://<your-name>.fly.dev/
```

## Point the app at your instance

Set this env var in **Vercel** (Project → Settings → Environment Variables),
then redeploy:

```
COBALT_API_URL = https://<your-name>.fly.dev/
```

The app tries your instance first and falls back to the public community
instance if yours is ever unreachable. Locally you can put the same line in
`.env.local`.

## Notes

- **Cost:** with `auto_stop_machines`, the single shared-cpu-1x/512MB machine
  sleeps when idle. First request after idle has a few-seconds cold start. Set
  `min_machines_running = 1` in `fly.toml` to keep it always warm.
- **Locking it down (recommended later):** the instance is open by default —
  anyone who finds the URL can use your bandwidth. To restrict it to this app,
  enable cobalt API-key auth (`API_AUTH_REQUIRED=1` + a keys file) and set
  `COBALT_API_KEY` in Vercel; the app already forwards it as an
  `Authorization: Api-Key <key>` header when that var is present.
- **YouTube** is intentionally out of scope here — it bot-blocks datacenter IPs
  (Fly included) and needs a residential IP or session cookies.
