# Every word in every language

## What

/pro, /privacy, /terms and /account became real pages in es, pt, id and ar, so the
sitemap went from 68 to 80 URLs. The 216 rare sentences (account panel, batch queue,
failures, Pro prompts) moved behind `d()`, with the English as the key and one lazy
chunk per language. Recently added and the 404 are translated. `en.lock.json` fails a
test when English changes, naming the field.

## Mistakes

- A codemod's fallback import landed above `'use client'` in AccountPanel. Types and
  tests were green. Only a lint warning on line 2 caught it, and it would have turned
  the page into a server component. Insert imports after the directive, never at
  byte 0.
- `formatDate` gained a `document` read and nine tests failed: it is called by pure
  code that also runs off the browser.
- The first `useD()` returned a translator. Threading it through helpers and async
  handlers would have touched every signature and gone stale inside `useCallback`. A
  plain `d()` plus a hook that only subscribes removed all of that.
- `window.location` lags `usePathname` during a client navigation, so `d()` cannot
  read the URL. The active language is set during render.
- /ar/account had CLS 0.031: the sign-in line painted in English, then swapped when
  the chunk landed. Translating a screen that is first paint needs a wait, not a
  fallback.
- Arabic with `{n}` cannot agree for every number. Sentences were reworded to "count:
  {n}", which no reviewer has to think about.
- A long Bash heredoc failed on quoting and ran nothing. Node scripts go through
  Write.

## What worked

- Comparing `main` innerText against live: the three English pages are identical
  after being rewritten as data.
- Giving the reviewer rules and files and no conclusion. It found 41 defects, three of
  them gender agreement in a legal sentence.
- The lock was seen red: one changed word named `.copy.legal.pro.badge`.

## Rules

- English copy edit: update the languages, then `pnpm i18n:lock`.
- A new rare sentence goes through `d('…')` as a plain literal. `pnpm i18n:deep` lists
  what is missing and the tests fail until it is translated.
- Text kept in data uses `dn()` and is shown with `dKnown()`. Unknown backend text
  stays as sent.
- Tier names and mail subjects stay English on purpose: Buy Me a Coffee shows those
  names, and the owner reads the mail.
