# Platform how-to steps and the brand entity

## What

- Every platform page has a "How to download {name} videos" section: 4 steps, the first naming where that app's Share button is and the URL shape, the rest on this site. Stored as `Platform.steps`, translated in es, pt, id and ar. The heading is `copy.landing.stepsTitle`.
- The platform HowTo JSON-LD now reads those same steps (`howToNode` takes `{ name, text }[]`). The old generic `platformStep1-3` strings were deleted. Step cards carry `id="step-N"`, matching the `#step-N` urls in the graph.
- `Organization.sameAs` is only the GitHub repo, so Google stops reading the brand as the founder. The Person keeps the personal links. WebSite and Organization `alternateName` is `['Social Downloader', 'socialdownloader.space']`.

## Mistakes

- The heading was first "How to download a {name} video". "Any Site" is a platform name, so the any-site page read "a Any Site video". It is now plural: "How to download {name} videos".
- The platform HowTo description said "three steps" in all five languages; the page now tells four. Changed with the steps, not left to drift.
- Reverting `structuredData.ts` to origin/main for the red run crashed the whole suite (it read the deleted `platformStep1`), which proves nothing per assertion. A red run needs a copy that is wrong, not missing.

## What worked

- One data file outside the repo (English plus four translations, keyed by slug), and one script that wrote the TS and the four JSON files, kept CRLF and key order.
- Deep strings (`src/content/locales/deep`) are only for `d('…')` sentences. Page content lives in `es.json` etc., and `localeContent.test.ts` already forces a new field into every language.

## Rules

- A new field on `Platform` goes in `PlatformText` and in the `english` map in `localeContent.test.ts`, then `pnpm i18n:lock`.
- A heading built from `{name}` must read right for every name, including "Any Site".
