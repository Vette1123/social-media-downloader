# Platform FAQ, and snippet bounds in every language

## What

- A per-platform FAQ already existed (`Platform.faqs`, one field feeding the visible `LazyFAQ` and the FAQPage JSON-LD, translated in es/pt/id/ar). Nothing was stacked; I tightened it instead: 4-5 entries each, the generic ones replaced by platform ones (TikTok watermark, Threads carousels, Threads quality and watermark), and the supporter-queue entries on YouTube, Pinterest, Reddit and Vimeo dropped to reach five.
- `seoLimits.test.ts` now covers every platform in every language, not just English: title <= 60, description 140-160. Eight descriptions were under 140 (one English, seven Arabic) and are lengthened. The Threads title now leads with "Threads Video Downloader".
- `platformFaq.test.ts`: 4-5 filled, distinct entries per platform and locale, and the JSON-LD equals the data the page renders.

## Mistakes

- I started to plan a new FAQ field before checking that one existed. Reading `PlatformLanding.tsx` first found `faqs` rendering and already in JSON-LD; the work was editing content, not building a section.
- The first test I wrote asserted that most entries name the platform. YouTube's answers say "Shorts" and "MP3" without the word, so it failed on good content. Dropped it: a heuristic that punishes right answers is noise.
- The first red run ran against nothing: the heredoc creating the test file sat behind a blocked command, so the file did not exist and vitest reported "no test files" with exit 0. Check the test file exists before trusting a red run.

## What worked

- A red run by writing origin/main's `platforms.ts` and locale JSON over the working copy, running, and copying mine back (29 failures), with no stash on a shared tree.
- Claims written from the extractor: Threads is read through the `/embed` view and returns one media item, so the carousel answer says a long carousel may give one item rather than promising all.

## Rules

- Before adding a content section, grep the component for the field that already feeds it.
- A length bound is asserted per locale: Arabic runs shorter than English for the same sentence.
- An FAQ answer never promises beyond the extractor: read `downloader.ts` for the platform first.
