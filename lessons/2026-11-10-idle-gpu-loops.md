# An idle desktop tab painted 650 times a second

## What
Opening the site on a desktop pegged the GPU. Two `infinite` CSS animations ran
for as long as the tab was open, and both repaint every frame: the hero card's
perimeter ring animated a registered `@property --bd` inside a `conic-gradient`
(the gradient image is regenerated per frame), and the headline's `text-flow`
animated `background-position` on `background-clip: text`. Every one of those
frames also composited a full-screen `mix-blend-mode: overlay` grain and three
blurred blobs. Phones and `.low-power` devices already dropped both; desktop got
everything.

Fix: the headline gradient is static everywhere (the phone look), and the ring
is now a real element in `<Surface glow>` (`.glow-ring > .glow-ring-spin`): a
static conic gradient rotated with `transform`, masked to the border, hidden and
paused at rest, fading in and spinning only under the pointer. Same picture,
compositor only. `pnpm perf:idle` measures it (homepage, 1440x900 desktop):

| Pointer | Before | After |
|---|---|---|
| Off the page | 653 paints/s, 2 infinite animations | 0 paints/s, 0 frames drawn |
| Resting on the hero card | 624 paints/s | 0 paints/s (ring spins on the compositor) |
| Moving | 772 paints/s | 313 paints/s (ordinary hover effects) |

Also fixed: `analytics.test.ts` failed on every Windows checkout (CRLF), so
`pnpm verify` was red locally while CI was green.

## Mistakes
- The first probe ran against production and reported 0.4 paints/s: "the site is
  already idle". It was measuring Cloudflare's "Just a moment…" challenge, which
  is what headless Chrome gets there. The probe now refuses a challenge page.
- The first "after" run reported 0 paints/s too, and that was a 500 page:
  Turbopack in a worktree whose `node_modules` is a junction to main's cannot
  find `next` ("Filesystem root used for resolution" is the worktree). The probe
  now refuses any page without an `<h1>`, and the worktree got its own
  `pnpm install --offline`. Two false greens in a row from a check that never
  asserted it was looking at the right page.
- A dev server's first seconds produce ~240 frames/s with zero paints, which
  looked like a hidden animation and cost a bisect. Warm the server first; count
  `DrawFrame`, not `BeginFrame` (BeginFrame ticks whenever frames are requested).
- Hiding the ring until hover alone was not enough: with the pointer resting on
  the hero card (where people paste and wait) it still repainted at 60fps. Only
  `--hover` in the probe showed it.
- The CRLF failure in `analytics.test.ts` was written down in this morning's
  lesson and left for later. It took two lines.

## What worked
- Bisecting with injected CSS (`pnpm perf:idle --css ".x{display:none}"`) named
  the cost of each layer in a minute.
- Calibrating the probe on a one-div page with a known infinite animation before
  trusting a "0".

## Rules
- Never animate a gradient, a registered custom property inside one, or
  `background-position` on an infinite loop. Rotate or translate a static layer.
- Decorative motion runs under the pointer, not at rest.
- A perf probe asserts it measured the real page before it reports a number.
- Run `pnpm perf:idle`, `--hover` and `--move` against `pnpm dev` after touching
  any animation in `globals.css`.
