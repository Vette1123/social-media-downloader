# The tip jar the framework threw away

## What

Added the Buy Me a Coffee floating widget to every page, loaded off the critical
path, in `src/app/layout.tsx` (`bmcWidgetScript`) plus one stacking rule in
`src/app/globals.css`.

The provider hands you a `<script src defer data-*>` tag and tells you to paste
it. That tag does not survive this stack, and the three ways it fails are the
lesson.

## Mistakes

**Pasted the vendor tag as JSX and called it done.** It vanished. React 19 does
not emit a `<script src>` without `async` into the prerendered HTML at all — no
warning, no error, no tag in `out/`. The build was green and the widget simply
did not exist. Caught only because the export was grepped for the vendor host;
had the check been "does the page still build", this would have shipped as a
donation button nobody could ever see.

**Then grepped the wrong directory and believed it.** `pnpm build` writes
`.next/`; the static export lives in `out/` and is produced by `pnpm cf:build`
(`DEPLOY_TARGET=cloudflare`). The `out/index.html` that was grepped after the
first fix was three days old, so a working change read as broken and a broken
one would have read as working. Check the mtime of any artefact used as
evidence.

**Reached for `async` as the obvious fix.** It makes React emit the tag, and the
widget still never appears: the vendor bundle does all of its work inside a
`DOMContentLoaded` listener with no `readyState` guard, so anything that starts
executing after that event downloads 8KB and does nothing. This is the same
reason all three `next/script` strategies fail here — the sister project had
already measured that, and the note in its layout is what saved a second round
of guessing.

**Nearly shipped it stacked over our own overlays.** The vendor sets
`z-index: 9999` on the button and `9999999` on its backdrop; the lightbox and
the account panel are at `z-50`. Two of the five nodes it appends to `<body>`
carry no id and no class, so they can only be selected by shape
(`body > div:not([class])`).

## What worked

Loading it deliberately instead of pasting it: inject after `load`, in idle
time, then dispatch one synthetic `DOMContentLoaded` on `window`. By then the
real event is long gone, so the synthetic one fires exactly once and only after
every other listener for it has run — which is what makes an event this global
safe to fake. Measured on the built export: navigation `loadEventEnd` 368ms,
widget request starts at 472ms. Nothing it pulls competes with first paint.

Reading the vendor bundle before writing anything around it (8KB, unminified
enough to grep) answered three questions no documentation would have:
`document.write` is not used, the DOMContentLoaded listener has no guard, and
`data-position` is compared against the literal `'left'` — so the capitalised
`Right` the provider's own generator writes works only because everything that
is not `'left'` falls through to the right edge.

## Rules

- A `<script src>` rendered by React needs `async` to appear in the HTML at all.
  If the third party cannot tolerate `async`, it cannot be a JSX tag — inject it
  from an inline script instead.
- Read the vendor bundle before wrapping it. Whether it waits for
  `DOMContentLoaded` decides whether it can be lazy-loaded at all.
- Grep the artefact the deploy actually uploads (`out/`, via `pnpm cf:build`),
  and check its mtime before trusting what the grep says.
- A third party that appends to `<body>` picks its own z-index. Give it one of
  ours, by shape if it offers no id.
