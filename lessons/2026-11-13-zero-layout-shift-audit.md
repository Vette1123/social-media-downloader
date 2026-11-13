# Zero layout shift on refresh, for every visitor

## What
After the supporter pre-paint mark (0eb8b12) a Pro refresh still moved: the batch
panel and other late pieces pushed the page down. Built `pnpm cls`
(`scripts/cls-audit.mjs`): headless Chrome over CDP, throttled like a phone,
reloads each route as a free, a returning and a supporter visitor at 390x844 and
390x6000, and fails on any layout shift. It names what moved AND what grew.
Fixed what it found; a slice of it now gates every deploy.

- Batch queue: the lazy `BatchPanel` popped in for supporters on load. It is now
  a one-line bar in the static HTML (`data-pro-only`, shown under `html[data-pro]`)
  that opens the panel on a press or a hand-off from Recent / the paste bar.
- FAQ: `LazyFAQ` removed its native `<details>` fallback the moment it decided to
  go interactive, then `next/dynamic` rendered `loading: () => null` while the
  accordion chunk downloaded. The whole FAQ (1,140 px) collapsed and came back —
  for EVERY visitor scrolling toward it, not just Pro. Now the module is imported
  first and the component set in state, so the swap is one render.

## Mistakes
- First audit runs read 0 everywhere: unthrottled, the JS landed before first
  paint. A detector that never fails proves nothing — the script now injects a
  300 px block on every run and throws if it sees no shift.
- The shift sources pointed at "Recently added" and the footer, which only
  moved. Two rounds were spent guessing the cause before adding the "grew" trace
  (height snapshot at DOMContentLoaded vs at the shift). It named the FAQ at once.
- The FAQ bug looked Pro-only because the tall viewport only reached the FAQ on
  the (shorter) supporter page. It was everyone's bug, seen on scroll.

## What worked
- Static HTML + a CSS attribute gate beats any JS-timed reveal: present from the
  first paint, nothing to wait for.
- `useState<ComponentType>` set after `import()` resolves, instead of
  `next/dynamic` + a boolean, for any lazy swap of something already on screen.

## Rules
- Never replace on-screen content with a `next/dynamic` whose `loading` is empty.
  Load the module, then swap.
- Anything shown only to one tier lives in the static HTML behind
  `data-free-only` / `data-pro-only`, never mounted late.
- Layout-shift claims are measured with `pnpm cls`, throttled, never by eye.
