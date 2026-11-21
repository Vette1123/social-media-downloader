# Dependencies to latest, 2026-11-21

## What

- Site: posthog-js 1.453.2, wrangler 4.166.0, vitest 5.1.1, workers-types 5.20261121.1.
  Next 16.4.6 and React 19.3.1 were already latest.
- `video/`: Remotion 4.0.545, React 19.3.1, @types/react 19.3, TypeScript 5.9 -> 7.0.2.
  TS 7 removed `baseUrl`; the `paths` were already relative, so it went.
- The `zod: 4.6.6` override is gone. Remotion 4.0.545 pins zod 4.6.7 itself (past the
  advisory the override was for), and keeping the override made Remotion print a version
  mismatch on every run.
- The `typescript` alias to TS 6 stays: typescript-eslint 8.73.0 still peers `<6.1.0`.

## Mistakes

- Read `typecheck 0` from a piped `tail` as a pass; the real `tsc` exit was the `baseUrl`
  error. Check `$?` of the command itself.

## What worked

- `remotion compositions` after the bump: it is the check that prints Remotion's own version
  mismatch, and it confirms both compositions are still 60 fps. One `remotion still` frame
  proved the renderer end to end.

## Rules

- When Remotion bumps its own zod pin, delete our override instead of chasing it.
- Re-check the typescript-eslint peer range on each deps round; the TS 6 alias goes when it
  allows 7.
