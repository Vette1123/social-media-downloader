# The site in five languages

## What
Home and all 12 platform pages now exist as static HTML in Spanish, Portuguese,
Indonesian and Arabic: 52 new indexable pages under `/es`, `/pt`, `/id`, `/ar`.
English URLs did not move. Each page has reciprocal hreflang, its own canonical,
localized JSON-LD and Open Graph, and a sitemap entry. The first HTML response is
in the page's language, including the paste bar, and the Arabic page is `rtl`
before any script runs. The 12 copy-pasted metadata blocks became one helper. All
audited routes score 100 on all four Lighthouse categories with CLS 0, and
`/pro`, `/privacy`, `/terms` now share as themselves instead of as the home page.

## Mistakes
- **Assumed a context provider would reach everything.** `HomeControl` and
  `AccountControl` render above `{children}` in the root layout, so a provider in
  `[lang]/layout` runs after them. Found by reading the layout. They now mount
  inside the provider on localized routes.
- **`setLocale` returned early on "no change".** With `es` stored, picking English
  on `/es` left `es` in storage, because `current` never adopted it on a localized
  URL. The English page would have flipped back. Caught by walking the picker by
  hand; no test would have asked.
- **Tried `git stash` for a baseline while three translators wrote to the tree.**
  The guard hook stopped it. It would have swept their output away.
- **Took 10 lint errors in files I had not touched for old ones, until I read the
  rule.** A `[lang]/[slug]` route makes `no-html-link-for-pages` match every
  two-part path, including the plain anchors a static export requires.
- **`{noun}` put an English word inside translated sentences.** A translator's
  note flagged it. The same notes flagged "Process URL", a button that does not
  exist in any language.
- **Exported `toRouteLocale` from a layout file.** Next allows only its own exports
  there, so it moved to `src/lib/routeLocale.ts` before the first build.

## What worked
- Reading the locale from the URL instead of threading it: one line in `useLocale`,
  correct in prerender, and client navigation between languages just works.
- Writing the validator before dispatching translators, so they fixed their own
  length and placeholder failures.
- A real browser run for hydration errors, overflow at 320 px and `lang` after
  client navigation. Looking at the Arabic screenshot found the URL samples with
  their ellipsis on the wrong side, which no assertion had been written for.

## Rules
- Anything rendered above `{children}` in a root layout cannot see a provider below it.
- A guard that bails on "same value" must run after any write the value does not cover.
- A translated string never receives an English word through a placeholder.
- On an RTL page, every URL needs its own direction.
- Copy for the page goes in `pageCopy` and `src/content/locales`, server only. A
  change to English copy does not fail any test: the translations need the same
  edit by hand.
