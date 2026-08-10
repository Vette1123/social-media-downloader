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
