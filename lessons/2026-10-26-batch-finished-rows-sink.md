# Batch queue: finished rows sink to the bottom

## What
The Pro batch list rendered rows in paste order. With 2–3 lanes, links finish out
of order, so "Done"/"Failed" rows were scattered through the list. Now
`displayOrder` (`src/lib/batchPresentation.ts`) keeps queued/resolving rows on top
in paste order and moves each finished row to the bottom in the order it finished.
A retried row leaves the finished group while it resolves, then rejoins at the end.

## Mistakes
None worth recording: the request ("appear last, randomly placed") was ambiguous
between the Recent history list and the batch queue; History already sorts newest
first on every read, so the batch queue was the only list with random order.

## What worked
Ordering inside `publish`, the single choke point every queue broadcast passes
through, so `items` state is already ordered and the render stays untouched.

## Rules
- Any list fed by parallel workers needs an explicit order; paste order is not one.
