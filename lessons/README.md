# Lessons

One file per finished unit of work — a feature, a fix, a release, an audit, a
refactor. Named `YYYY-MM-DD-slug.md`, committed *with* the work rather than
after it.

Format:

```markdown
# <title>

## What
One paragraph: what the unit of work actually was.

## Mistakes
The wrong turns. What was assumed and turned out false, what was verified the
wrong way, what nearly shipped, what was built and then deleted. This section is
the point of the file — git already records what was built. If there genuinely
was no wrong turn, say so in one line and keep the file short.

## What worked
The approaches worth repeating.

## Rules
Short imperatives for next time.
```

Read the lessons touching an area before starting work in it; the table below is
the index for exactly that.

| Date | Lesson | The one thing |
| --- | --- | --- |
| 2026-08-10 | [Creem payout-account rejection](2026-08-10-creem-payout-rejection.md) | A reviewer reads the marketing, not the code — "no watermark" describes a circumvention tool even when the code only fetches public files. |
| 2026-08-10 | [Withdrawing the subscription](2026-08-10-withdrawing-the-subscription.md) | When the question is "who gets this feature", change the input to the decision, never the decision points — and a capability that must never be sold needs its own name, not a flag inside one that is. |
| 2026-08-13 | [Every generic platform was dead, and one was pretending not to be](2026-08-13-platform-sweep.md) | The shared public resolver is blocked by the origins it resolves, so each platform now reads its own embed surface first — and a sweep that only checks `success: true` will score an HTML error page as a working video. |
| 2026-08-13 | [The Instagram session was fine; every path that used it was dead](2026-08-13-instagram-media-api.md) | Instagram's GraphQL `doc_id` now answers "execution error" for everyone, so the credentialed path had to move to `/api/v1/media/<id>/info/` — prove a credential with one endpoint only it can answer before blaming it. |
| 2026-08-10 | [Footer apps menu, batch textarea](2026-08-10-footer-apps-menu.md) | `.surface` is unlayered CSS that owns `position` — anything absolute against it needs a wrapper — and a layout change is not verified until the page is on screen. |
