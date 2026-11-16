# Threads share links and photo posts

## What
`resolve_failed` by `shape` showed `www.threads.com/share/<code>` (the Threads app's Copy link) failing as generic `unsupported`. Now: the validator calls it Threads, `isShortLink` follows it, and `resolveRedirect` asks as a link crawler (`isCrawlerOnlyShareLink`, renamed from `isFacebookShortLink`), because Threads 302s only for a crawler. Photo-only Threads posts had no `<video>`, so the page scorer returned null and they read as "private"; `threadsEmbedImages()` now returns them as a carousel. Also dropped the media-fetch `AbortError` as noise.

Verified live: share link → video, share link → 8-photo carousel, text-only post → error.

## Mistakes
- Probed `/share/` with a made-up code, saw 200 and no redirect, and told the user it needed a real link from them. Real codes found via `gh search code` 302 at once. A fake id tests the 404 path, not the feature.
- Even with real codes, the first fix (follow the redirect) still failed: the downloader's desktop-Chrome agent gets 200, only a crawler gets 302. Compare user agents before assuming a redirect is followed.
- Stashing for a red/green run is blocked by the working-tree guard (and so is a heredoc that merely mentions the command); copy the one file aside instead.

## What worked
- `properties.shape` on failures names the URL pattern without storing the URL.
- Public share codes in GitHub code search: real fixtures without spending anyone's account.
- Running `Downloader` live through a throwaway vitest file (no tsx installed); write results to a file, since `-s` hides console output.

## Rules
- Probe a link shape with real ids before concluding anything about it.
- A share link that 200s for a browser: try the crawler agent next (Facebook and Threads both do this).
