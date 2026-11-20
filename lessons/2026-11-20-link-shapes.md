# Link shapes from the failure log (2026-11-20)

## What
Worked the 3-day `resolve_failed` table (PostHog, by `platform`/`host`/`shape`):
- Run-together links (`https://a…https://b`) split into tokens; the first one wins.
- TikTok `/@/photo/<id>` (empty handle) accepted; a short link that resolves to nothing says the link is retired.
- Telegram: `/s/` forms accepted; a text-only post, a removed post, a too-big clip and a private `t.me/c/…` group each get their own reason, and that reason is final (no 6 s walk through Cobalt and the scraper first).
- `t.me/<channel>` gets "That is a Telegram channel, not a post" advice.
- `pnpm link:probe <url…>` runs the real Downloader from this machine and exits 1 on any failure.

## Mistakes
- Read X's 75 failures as an X bug. Per-day successes (40–110/day) showed it is 1–5 people retrying the same private posts. Check the success column before "fixing" a platform.
- First Telegram version kept a "reason" and kept trying other methods; it took 6.5 s to say "text only". The embed page is the authority, so it now throws at once.
- Facebook `/share/r|v/` (23 people) is still open: no real share code was findable, and a made-up code only returns Facebook's generic 200 page, so nothing could be reproduced. Not shipped blind.

## What worked
- `host` on `resolve_failed` turned "generic `/*/#`" into "t.me", which made the Telegram work obvious.
- Probing production `/api/download` directly showed Telegram already resolves there.

## Rules
- A failing shape counts only against its success count and distinct people.
- A new user-facing sentence needs the four `deep/*.json` translations plus `pnpm i18n:lock`.
