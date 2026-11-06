# The button that looked broken

## What

PostHog showed 130 people rage or dead clicking on `/` in a week. Most of it is
harmless: tapping the empty link field (about 42 people) or the format chip that
is already selected. Two targets were real gaps. The main Download button turned
dim and silent during audio, image and video transfers, with a spinner only while
resolving. It now shows a spinner and "Downloading..." for every busy state
(`mainButtonLabel` in `src/lib/appReducer.ts`). Paste on an empty clipboard only
focused the field. It now says the clipboard is empty, in all five languages, and
reports `paste_chip {outcome: 'empty'}`.

## Mistakes

None. The click events do not record whether the page was resolving or
downloading, so the button verdict rests on the code path, not the data.

## What worked

Grouping `$rageclick`/`$dead_click` by element before touching anything. Most of
the 130 people were not hitting a bug.

## Rules

- A disabled control says why it is disabled. A dimmed button with an unchanged
  label reads as broken.
