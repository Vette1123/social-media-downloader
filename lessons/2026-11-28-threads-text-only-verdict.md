# Threads text-only posts get a verdict, not "may be private"

## What

#100/#101 (Threads 69% failing, all `www|/share/*`, code `inconclusive`). The share hop is fine:
the fixture share link resolves locally and through production `/api/download` (run from a
Chrome tab on the site, since curl gets the Cloudflare challenge). The failing share code lands on a
text post with a link card. Its crawler-agent `/embed` renders `BodyTextContainer` plus the
author's `-19` avatar, with no `<video>` and no `-15` photo. `tryThreadsEmbed` returned null, the
chain fell through, and the visitor read "may be private" after 19 s.

Now an embed that rendered the post's text and held no media throws `THREADS_POST_HAS_NO_MEDIA`
("text only, or its media was removed"), the same wording X and Telegram use, and it lands in
1 s. `TelegramEmptyPost` became `EmptyPost`, since a second caller needed the definite-verdict
exit. The app shell (no `BodyTextContainer`) still returns null, so Cobalt gets its try.

## Mistakes

- Read `landed` = empty on all 32 failures as "the hop never moved in production". The generic
  path never sets `landed`; only Facebook's does. The production API call settled it.
- The first scripted edit replaced the class name but missed the doc-comment anchor, so the
  constant never landed. tsc caught it. Check a scripted edit's match count for every anchor.

## What worked

- `posthog:query` grouped by `shape` and `code` per day. Every failure was `/share/*` and
  every success came from elsewhere, which pointed at what a share link lands on.
- Comparing the crawler-agent embed of a working post with a failing one.

## Rules

- Before blaming a share-link hop, resolve the hop with curl as the crawler and probe the
  target post on its own.
- A page read in full with no media throws `EmptyPost` with a reason, never returns null.
