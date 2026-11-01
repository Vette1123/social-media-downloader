# Store links belong to the browser

## What

A Mac visitor reported that the Masareef and Rafiq cross-promo opened nothing. Desktop store
anchors now navigate natively instead of cancelling the click for `window.open`, a blocked
`window.open` falls back to this tab, and our own apps' ad cards drop `?subid=` and
`rel="sponsored nofollow"`.

## Mistakes

- Our own apps sat on the affiliate path: a subid nothing reads, and a nofollow that told
  Google to ignore the links to our own pages.
- The dead click never reproduced in Playwright WebKit, which has no Safari popup blocker or
  content blockers. The fix removes the fragile paths; it is not a proven diagnosis.

## What worked

Clicking every live anchor in a real engine, with a hit-test, separated the page from the
click path. Reely took the same fix the same hour.

## Rules

- `ownApp` offers are plain links: no attribution parameter, no sponsored rel.
- A real anchor keeps its own navigation unless a device needs something else.
