# Honest resolve copy, the LinkedIn cover guard, and the unsaved count

## What
Three follow-ups from the SoundCloud/Dailymotion/LinkedIn chunk: a guard in
`tryLinkedInPost` against LinkedIn serving its own cover JPEG as `og:video`
(verified live), platform-aware resolution-failure copy for SoundCloud (HLS
through its player) and LinkedIn (signed-in only) where the generic "post may
be private" 422 would be false, and a truth-telling count on the Recent
"unsaved" row when the queue cap would silently drop links.

## Mistakes
- The first version of the failure-copy tests stubbed a fetch that answered
  one empty string, which trips `looksLikeBotWall` (anything under 2 KB is a
  wall by design) — the resolve chain never reached the new copy and threw
  `OriginBlockedError` instead. The tests then also hung for 5 s each because
  `nativeMediaAvailable()` is true on a dev box, so `downloadGeneric` went on
  to spawn a real yt-dlp process against the network. Both fixed by staging
  the stub page above the wall floor and mocking `./nativeMedia` to pin the
  native gate off — the same file-level `vi.mock` seam `downloaderStory.test`
  and `downloaderYouTube.test` already use.
- The first capped-count copy ("of 30, the queue's cap") read ambiguously and
  said "not saved yet" no longer; final copy: `Queueing the oldest N of M`.
  The count is structurally bounded (Recent caps at 30, queue takes 20), so
  the row cannot overflow — no truncation needed.

## What worked
- Writing the byte-by-byte live verification (`li-bytes.mjs`) *before* coding
  the guard: the rejection is one line pinned by a real-shaped URL fixture
  (`/dms/image/v2/…/videocover…`) that fails red without the guard.
- Testing failure copy through `downloadVideo` at full chain depth rather
  than calling `downloadGeneric` directly — the wall verdict is part of the
  user-visible behaviour, and only a full-chain test sees which one fires.

## Rules
- A stubbed page must clear every floor the real path checks (bot-wall byte
  floor, native gate) or the test drifts into a different failure class than
  the copy it means to pin.
- When hosts wall datacenter egress (SoundCloud, LinkedIn do), the
  `OriginBlockedError` message legitimately wins over per-platform copy — it
  surfaces verbatim by design. Platform copy only fires where resolution
  genuinely went through.
