# YouTube MP3 outage, and a watcher that judges MP3 apart from video

## What
The second sweep of the day. The error board was empty and the watcher had nothing new, but
`posthog:usage` showed YouTube audio failing 37 of 60 resolves in 7 days. Per day it went from
about 90% ok to 0 ok since 2026-11-19 (0/37). YouTube downloads of any kind fell from ~14 a day
to 2-5 a day starting 2026-11-17.

The cause is upstream. Both default Cobalt instances answer `error.api.youtube.login` for 5 of 6
well-known videos (from this PC and from the Worker), and Innertube from the Worker gets
`LOGIN_REQUIRED` from both ANDROID_VR and IOS (`wrangler tail` on a real prod MP3 request). The
via-video fallback hits the same Innertube wall. Video "succeeds" only as an embed-only result
(`embedUrl`, no file), so pooled YouTube resolves looked healthy.

Code changes:
- `posthog:watch` groups platform rates by format; an MP3 collapse files `platform:<p>:audio`.
  Video rows keep the old `platform:<p>` key, so already-filed issues still match.
- On the generic extractor, `unsupported` never files a shape issue, t.me included. #87 recoded
  Telegram's own verdicts (over embed limit, deleted, private channel) as `unsupported`, which
  would have filed a noise issue on the next daily run.
- `pnpm link:probe --audio` runs the MP3 flow, and the probe prints a same-origin proxy path
  instead of throwing `Invalid URL` on it.

No extractor change. Restoring YouTube needs a Cobalt instance with a YouTube session (the
`COBALT_API_URL` env), which is the owner's decision.

## Mistakes
- The first suspect was `070f9ac` (11-19, the audio tunnel probe), because it landed the same
  day audio hit 0. The prod tail showed Cobalt never returned a tunnel for the failing video, so
  the probe was never reached. Read the Worker log before blaming the nearest commit.
- The 359/359 YouTube video "ok" read as proof that the video path works. An embed-only answer
  is a resolve success and not a download. Check `download_completed` per day, not only
  resolve rates.
- `link:probe` printed `Invalid URL` for every YouTube link on its first run. The probe script
  threw on the relative `/api/youtube` path, not the Downloader.
- cobalt.directory now blocks this IP even in Chrome, and instances.cobalt.best is down. A
  hand-picked list of instances was the only source. `rue-cobalt.xenon.zone` answers YouTube
  again, but its tunnels stream 0 bytes. Status `tunnel` alone is not a working instance.

## What worked
- `posthog:query` by day x format found the cliff in one query.
- One `wrangler tail` plus one `curl` to prod `/api/download` with `format: "audio"` gave the
  whole chain's verdict (Cobalt 400, Innertube LOGIN_REQUIRED twice).

## Rules
- Judge MP3 and video separately in every health number. An embed-only video hides an outage.
- A Cobalt instance counts only if its tunnel's first bytes arrive.
- Before blaming a commit for a cliff, read one production log of the failing request.
