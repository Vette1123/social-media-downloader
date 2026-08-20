# The close button we broke ourselves

**Date:** 2026-08-20
**Area:** `src/app/globals.css`, `src/app/layout.tsx` — Buy Me a Coffee floating widget

## What

The tip jar would not close on a phone. Tapping the chevron — the icon the
widget swaps in once the panel is open, the thing that *looks* like a close
button — did nothing, leaving a full-screen iframe with only a 16px `×` in the
corner as the way out.

Fixed by dropping the widget button one layer, `#bmc-wbtn { z-index: 39 }`, so
the vendor's own overlay sits above it again. Also set `message:''`, so the
widget no longer shows a bubble at all.

## Mistakes

**Reported as a vendor bug; it was ours.** The instinct on a third-party widget
misbehaving is that the third party is at fault, and the honest reading of the
bundle is that it *is* badly written — `#bmc-wbtn`'s `onclick` only ever opens.
It swaps the coffee cup for a chevron and keeps the same open-again handler.
There is no toggle anywhere in the file.

But it works everywhere else, because the bundle closes by accident of
stacking: opening inflates a class-less `<div>` overlay to 100%×100% at
`z-index: 9999999`, above the button's `9999`, so the tap that *appears* to
land on the chevron actually lands on the overlay, and the overlay's `onclick`
is the close handler. The chevron is a picture of a button, not a button.

Our own rule, added earlier to keep the tip jar under the lightbox and the
account panel, flattened that:

```css
body > div:not([class]) { z-index: 40 !important; }
```

`#bmc-wbtn` is a class-less direct child of `<body>` too, so it matched the
selector meant for the overlay. Both landed on 40, the tie broke on DOM order,
and the button is appended *after* the overlay — so the button rose on top and
the chevron started re-running "open". The rule's comment reasons carefully
about which of our overlays must stay above the widget and never asks whether
the widget's own pieces still stack correctly against *each other*.

**Nearly patched the symptom.** The first fix that came to mind was a capture
-phase click handler on `#bmc-wbtn` that closes when open — new script, new
state to keep in sync with the vendor's, in a file whose entire comment block
argues for shipping less script. The one-line z-index restores the vendor's
intended ordering inside our band instead.

**Not verified on a device.** `tsc` is clean and the reasoning traces the whole
bundle, but nothing here has been tapped on a real phone. The 2026-08-10 footer
lesson already says a layout change is not verified until the page is on
screen, and this is a layout change.

## What worked

Reading the minified bundle rather than guessing. `curl` it, expand `;{}` onto
their own lines, and 8KB of vendor code becomes eight readable handlers — from
which the button-never-toggles fact falls straight out. The behaviour could not
have been derived from our source, because the bug is not in our source: it is
in how our source interacts with theirs.

## Rules

- A `z-index` rule aimed at a third-party widget must name which of its nodes
  it hits. `body > div:not([class])` is a shape, not a target, and a widget
  that appends five bare `<div>`s will hand you all five.
- When a `!important` band flattens several nodes to one layer, DOM order
  decides — and appending order inside a vendor bundle is not something we
  control or can see from our own files.
- Before writing a handler to fix a third-party widget, read its bundle. The
  behaviour that looks missing is often present and being blocked by us.

---

Related: [2026-08-19](2026-08-19-bmc-widget-static-export.md) — the same widget,
and the same shape of error: a conclusion about the vendor drawn without
looking at what our own build was doing to it.
