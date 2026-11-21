# Telegram explanations filed as our faults

## What
PostHog issue `01a18e22-36a9-7923-abd7-cd91071e09a7` (2 people, 4 events, /telegram-downloader):
`[resolve:generic] Telegram does not show this post's media outside the app …`. The message is a
diagnosis we show the visitor (Telegram withholds the media from its public embed), not a fault.
`failureCode` matched none of its words, so it fell through to `upstream` and became an
`$exception`. `TELEGRAM_POST_TEXT_ONLY` fell through the same way and had not fired yet.
Verdict: our bug in classification. Fixed with rules for `outside the app|embed size limit`
(unavailable) and `no video or image|text only` (unsupported).

## Mistakes
- New user-facing failure strings were added in `telegramPost.ts` without a classifier test, so the
  only check was production traffic.

## What worked
- Pinning every exported `TELEGRAM_*` explanation in `analyticsErrors.test.ts`, red first (3 of 4
  failed; NOT_FOUND already read as `private`, which is accurate and expected).

## Rules
- Any new constant message shown to the visitor for a failure gets a row in
  `analyticsErrors.test.ts` asserting `isExpectedFailure`. Otherwise it becomes an Error Tracking issue.
