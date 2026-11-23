# Every surface unwraps redirect links; MP3 shapes stay under the outage

## What

`posthog:watch` reopened #73 and filed #88 and #89 on 2026-11-23.

- **#73 (google.com wrapper lands in generic):** this one was real. A `google.com/url?url=…` link failed at 13:25Z today, two days after the 11-21 unwrap fix. Only the paste box ran `extractLink`. The batch queue and a re-pick call `resolve()` with the link as pasted, so the client judged and reported the wrapper as itself. `resolve()` now unwraps first, which covers every surface. The test sends a Google-wrapped TikTok link through `resolve()` and expects the TikTok path with the inner link (red before, green after).
- **#89 (youtu.be `?si` inconclusive):** all 13 failures were `format=audio`. YouTube video resolved 366 of 366 in 7 days and audio failed 38 of 47. That is the #88 MP3 outage seen through one link shape. The watcher's shapes query now groups by format, and an audio shape finding is dropped while the same platform has an MP3 outage finding. With no outage on file, the shape still files as before.
- **#88 (YouTube MP3 100%):** the upstream login wall from 2026-11-22. Nothing changed. It stays open as the tracker until a Cobalt instance with a YouTube session exists, which is the owner's call.
- Board: `posthog:issues` showed 0 open of 8. Bing had 0 crawl issues. GSC read the sitemaps with 0 errors.
- Facebook `inconclusive` rose from 10 a day (11-21) to 32 (11-23, 8 people), spread across `/share/*`, `/reel/#` and group shapes at 1-3 people each. Public videos probe ok (2 of 2). The closed #67 and #69 reopen through the watcher if it holds after the window.

## Mistakes

- The first read of #73, by a subagent, was "false reopen: both events predate the fix". It counted only the two 11-20 events. A direct query found a third and a fourth (11-20 17:01Z, 11-23 13:25Z). Query the events yourself before you call a watcher reopen false.
- Its suggested fix was to drop `google.com` from `SUPPORTED_HOSTS`. That would have blinded the watcher to the real bug.
- The subagent got stuck because the parent session had entered a worktree in another repo, and the shell refused to run outside it. Don't run a cross-repo subagent while the session is worktree-isolated.

## What worked

- Reading the client's call graph (`resolve()` callers): one unwrap in the shared function covered three surfaces.
- Splitting the YouTube failures by `format` before touching the extractor.

## Rules

- Normalise input in the shared entry point (`resolve()`), not in one caller.
- A shape issue on a platform with an open outage is the outage until proven otherwise; split by format first.
