# A stale directory answered a question I never asked it

## What

Added the Buy Me a Coffee floating widget to every page, loaded off the critical
path, in `src/app/layout.tsx` (`bmcWidgetScript`) plus one stacking rule in
`src/app/globals.css`.

The provider hands you a `<script defer src data-*>` tag. It works. It is what
the sister project ships. It is still not what belongs on a page whose whole
pitch is speed, and the interesting part of this is not the widget — it is how
close a wrong root cause came to shipping as the justification for it.

## Mistakes

**Diagnosed a fabricated framework bug and wrote it into a commit message.**
The vendor tag was pasted in as JSX, `pnpm build` was run, `out/index.html` was
grepped, and the tag was not there — so the conclusion was "React 19 drops a
`<script src>` without `async` from the prerender". That is false. `pnpm build`
writes `.next/`; the static export lives in `out/` and comes from `pnpm cf:build`
(`DEPLOY_TARGET=cloudflare`). The `out/` that was grepped was three days old and
had never seen the change. The tag renders fine — proven afterwards with a
one-line probe script through a real `cf:build`.

The stale directory was noticed and fixed at the time, and even written down as
a mistake — but only as a step that had gone wrong on the way to the answer. The
answer it had produced was left standing. That is the actual lesson here: when
the evidence for a conclusion turns out to be void, the conclusion does not
survive on the strength of having been believed. Re-run it.

It survived a build, a browser check, a lint, a typecheck, a commit and a deploy,
because every one of those confirmed the *replacement* worked. Nothing anywhere
re-tested the thing it replaced. It came apart in one question from the person
who asked for it — "reely has the same optimisation, right?" — because reely
ships the plain tag and reely's live HTML has it.

**Read a sibling project's note as agreement.** The sister layout says all three
`next/script` strategies download the bundle and never run it. True, and about
`DOMContentLoaded` timing — nothing to do with whether a tag gets prerendered.
It felt like corroboration because it was next to the same widget.

## What worked

Reading the vendor bundle (8KB, greppable) before building anything around it
answered three questions no documentation would have: `document.write` is not
used, the `DOMContentLoaded` listener has no `readyState` guard, and
`data-position` is compared against the literal `'left'` — so the capitalised
`Right` the provider's own generator writes works only because everything that
is not `'left'` falls through to the right edge.

The shipped approach stands on its own without the invented bug. A deferred
script still downloads during page load and still delays `DOMContentLoaded`;
this one is injected after `load`, in idle time, and then handed a synthetic
`DOMContentLoaded`. Safe only because of when it happens — the real event is
long gone, so the synthetic one fires once, after every other listener for it
has run. Measured on the built export: `loadEventEnd` 368ms, widget's first
request 472ms.

The z-index fix was a real find: the vendor sets `9999` on its button and
`9999999` on its backdrop, over our lightbox and account panel at `z-50`, and
two of the five nodes it appends to `<body>` carry no id and no class, so they
are reachable only by shape (`body > div:not([class])`).

## Rules

- Evidence that turns out to be stale invalidates the conclusion drawn from it,
  not just the step. Re-run the original test before keeping the answer.
- Verifying that the fix works is not verifying that the diagnosis was right.
  Those need separate checks, and the second one is the one that gets skipped.
- Grep the artefact the deploy actually uploads — `out/`, via `pnpm cf:build` —
  and check its mtime before believing a zero-hit grep.
- A sibling project that ships the thing you just declared impossible is the
  cheapest disproof available. Check it before writing the claim down.
- Read the vendor bundle before wrapping it. Whether it waits for
  `DOMContentLoaded` decides whether it can be lazy-loaded at all.
- A third party that appends to `<body>` picks its own z-index. Give it one of
  ours, by shape if it offers no id.
