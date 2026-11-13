# Our apps' cards in the first screen after a result

## What

The owner's call: the Masareef and Rafiq cards under a result must be well seen. At 390×844 they sat about a
screen below the result, behind a 350 px auto-opened preview and the support nudge. Now:

- On a phone-width screen (`max-width: 639px` at resolve time) the preview starts closed (`autoOpensPreview`
  `compact`). "Show preview" is one tap away, and the header thumbnail already identifies the post.
- Order under the result: the apps' cards, then the support nudge.
- After a resolve the first card is 100 % on screen (top 608, bottom 839 of 844) and the second starts 7 px under
  the fold. A save moves nothing.
- New event `promo_seen`: at least half the card on screen for one unbroken second, once per card (`createDwell`).
  `promo_shown` fires on mount, which counted cards nobody scrolled to; the gap between the two is now measurable.

## Mistakes

- I had offered to put the two cards side by side on phones to save space. The owner wanted the opposite: the
  cards stay full size, and what changes is what pushes them down.
- The dev server's reload loop (a GET every ~250 ms with "Compiled in 1ms") looked like a bug in this change. It
  was another client on :3000 stuck reloading, and Next's dev reload reaches every connected client. Moving the
  harness to `next dev -p 3001` isolated it. Count loads on the iframe before blaming the code.
- The previous reorder moved the support nudge in between the sponsor slot's comment and the slot itself, so the
  first attempt to swap them grabbed the wrong span and changed nothing. Read the result of a block move.

## What worked

- One geometry helper (top, height, visible %) per card, read after resolve and after save, answered "is it
  seen" with numbers instead of screenshots.

## Rules

- Mounted is not seen: an impression metric needs on-screen time, not a mount.
- When something must be seen, remove what's in front of it; don't shrink the thing itself.
