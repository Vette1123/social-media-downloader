# README refresh and a sponsor slot booked by email

## What

The README was audited against the code and rewritten where it had drifted:
TypeScript 7 and Motion 14, Node 22, fifteen landing pages in five languages,
the Telegram bot, Threads photo posts, the Facebook gated-share message, clips
only for Twitch, SoundCloud, the missing URL formats and env vars, a project
tree that matches `src/`, a scripts table, and the three cross-cutting fallback
rules (supporters hit the private Cobalt first, a tunnel counts once it streams,
walled pages go through a relay). A highlighted "Sponsor this project" block now
sits under the films, with a mailto link whose subject (`Downloader sponsor
slot`) a Gmail filter answers with a template. `deploy/cobalt` and
`deploy/resolver` lost their Hugging Face and TikTok-only wording and gained
`RESOLVER_COOKIES_URL` and `RESOLVER_PROXY`.

## Mistakes

- I first planned a GitHub Sponsors badge for the sponsor block. The owner
  wants sponsors to email, and the README never links a payment page, so the
  call to action is the mailto alone.
- The support copy said "Nothing here is for sale" while `SUPPORT_PRICES`
  holds $5/$50/$99. Two true statements from different months read as a
  contradiction; the README now states the prices.
- A Python heredoc with nested quotes broke bash parsing. Long edit scripts go
  in a file, not a heredoc.

## What worked

One edit script with an `assert old in s` per replacement: any drift between
the audit and the file fails loudly instead of silently skipping an edit.

## Rules

- A mailto in the README uses the same subject as the site's own button, so the
  Gmail filter answers it. Change one, change the filter.
- Never say the extras are switched on "by hand"; say "once the payment is done".
