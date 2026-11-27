# Dailymotion es/pt pages: content Google can't get elsewhere

## What
`/es/dailymotion-downloader` and `/pt/dailymotion-downloader` are the only two of 95 sitemap URLs that sit
in "Crawled - currently not indexed" (last crawled 16 and 18 Nov). Live inspection is otherwise clean: fetch
OK, indexing allowed, Google's canonical = ours, both in the sitemap, linked from their locale home. So the
call is quality, and the copy was the one lever.

The Dailymotion page (all 5 languages) now has:
- a 4th card and a 6th feature: save just the soundtrack as MP3;
- FAQ 5 is "Can I save only the audio?" in place of "Why does my link fail?", which repeated FAQ 1;
- FAQ 2 explains the `x…` video ID, so `dailymotion.com/video/x8abc12` and `dai.ly/x8abc12` read as one video.

Both claims were proved on production first: `POST /api/download` with `format: audio` returned
`success: true` and an `audioUrl` for `dailymotion.com/video/xc04nhi` and for `dai.ly/xc04nhi`. MP3 is
supporter-only for YouTube alone (#91), so it is free here.

Also fixed on the way:
- `pnpm lint` failed on another session's worktree (`.claude/worktrees/video-instead/.oxlintrc.json`). An
  `ignorePatterns` entry does not stop oxlint loading nested configs; `--disable-nested-config` does. Both
  are in now. The root config is the only one the repo owns.
- `siteRules.test.ts` "passes a non-hex token through" timed out at 5 s in 1 of 4 runs: it was the only test
  in the block without a `fetch` stub, so the media HEAD probe hit the real network. Stubbed, and it asserts
  the stub was called; 5/5 runs in ~0.2 s.

## Mistakes
- First draft added two FAQs on top of five. `platformFaq.test.ts` caps every platform at 4-5 entries, so
  the gain had to come from swapping a duplicate answer out and from cards/features, which have no cap.
- First lint fix (ignorePatterns alone) changed nothing; the error comes from config discovery, before any
  file is matched.

## What worked
- Re-inspecting the two URLs live before writing copy (4-day-old ledger data), then comparing referrers with
  an indexed sibling (`/es/twitch-clip-downloader`).
- Proving a feature claim against the production API before putting it in five languages.

## Rules
- Platform FAQs stay at 4-5; add depth through a card or a feature instead.
- New copy that claims a capability is checked against the live API first.
- oxlint runs with `--disable-nested-config`; `.claude/` holds other sessions' worktrees.
- A test that calls resolve code stubs `fetch`, every time.
- Request Indexing for the two URLs once the deploy is live and the day's tier-1 quota allows (rolls to 28 Nov).
