# Both apps at once

## What

The offer slot now shows Masareef and Rafiq together: two equal cards, side by side from
`sm`, stacked on phones, with a 56 px icon and the site's primary button. `selectOffers`
returns the top two, so the seed, `useId` and `hashToSeed` are gone. Reely got the same
change in its own footer strip.

## Mistakes

- "Shared by platform" shipped as if it meant both apps show. Each page got one app for
  good, so the owner saw Rafiq and read it as Masareef being replaced. The test passed
  because it looked across eight platforms, and nobody browses eight platforms.
- The test also hashed `:r1:`, a made-up `useId`, not the value the page really gets.
- The first fix alternated per view. The owner wanted both on screen, which "I want both"
  already said. That whole turn counter was built and deleted.
- The red check on that attempt never ran: `String.replace` matched nothing against CRLF,
  the mutation was a no-op, and 17 passing tests looked like a result. A red check that
  stays green means the mutation failed, so read the count.
- The inline heredoc broke the shell. The last lesson already said Node scripts go through
  Write.
- `tone='accent'` on the button still read as muted. "Well advertised" needed `btn-grad`,
  which only showed in a screenshot.

## What worked

- Measuring the slot in iframes, 5 languages by 6 widths, gave real reserved heights where
  the old 188/98 box was short by more than half.
- Asking the live session in the other repo. It took Reely inside a minute.

## Rules

- A test for "the user sees both" follows one user on one page.
- A slot that must show two things renders two things. Rotation is a different feature.
- Reserved heights come from measuring every language, not from the English card.
