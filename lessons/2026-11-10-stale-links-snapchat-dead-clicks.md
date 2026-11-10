# Stale signed links, Snapchat @user/spotlight, repeat errors that changed nothing

## What

- **Save on an old result** fetched a signed CDN URL that had expired (Twitter/X 403 in PostHog). `fetchFreshMediaBlob` in `DownloaderApp.tsx` now catches a 403/404/410 (`isStaleLinkError` in `src/lib/retry.ts`), re-resolves the original post once (`source: 'refresh'`), and fetches the fresh URL.
- **Snapchat `snapchat.com/@user/spotlight/<id>`** share links were detected as "generic" and failed. The pattern was added to `validator.ts`.
- **Download/Paste dead clicks** (11 + 8 people): a repeat press with the same bad input set an identical error, so nothing in the DOM changed. Every error now bumps an attempt counter that remounts the message (re-animates) and focuses the input.

## Mistakes

- First curl reproduction of the Twitter 403 used a short user agent; the 403 was the site's own WAF, not X. Production with a full Chrome UA returned 206 at every range. Test through the WAF with a browser UA.
- `EnterWorktree` pinned the subagents' shells to its directory; manual `git worktree add` worktrees were needed for parallel agents.
- Ran `git config --local core.autocrlf false` to fix CRLF test failures, which changed the shared repo config. Reverted with `--unset`; use `git -c core.autocrlf=false worktree add` instead.
- A CRLF checkout fails `analytics.test.ts` and `localeContent.test.ts` locally only — not a regression.
- Focusing the input inside the `setUrlError` wrapper failed the `react-hooks/refs` lint; the focus lives in an effect keyed on the attempt counter.

## What worked

- PostHog `$dead_click` elements chain plus `aria-pressed` told the chip dead clicks (re-tapping the selected chip, by design) apart from the real ones (paste-bar button in error state).
- Checking 5 public spotlight links in production: 4 resolve, the fifth is an unavailable post (no og:video).

## Rules

- A signed media URL is a lease: any fetch of one made after the result was shown needs a re-resolve path.
- A button that "does nothing" on repeat often does the same thing twice. Make the second press visibly different.
