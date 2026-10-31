# Everything to latest

## What

Every package went to latest, including Next 16.4.3, React 19.3, TypeScript 7, ESLint 10,
Vitest 5, motion 14 and pnpm 12. Stale leftovers from the Vercel and OpenNext days went
with it: `nodeLinker: hoisted`, the `postbuild` hook and its `.npmrc`, the release-age
list, `onlyBuiltDependencies`, `audioExtractor.ts` and dead exports.

## Mistakes

- OpenNext was named as the riskiest dependency when it had not been installed for
  months. The name came from a comment in `pnpm-workspace.yaml`. A comment is not
  evidence: read `package.json` before naming a dependency.
- That stale comment was also the only reason left for `nodeLinker: hoisted`, and the
  workaround outlived its cause by months.
- `tsc` passing on TS 7 looked like the upgrade had worked. ESLint and the translation
  lock test both failed later, because TS 7 ships no compiler API to import.

## What worked

- Reading the error before pinning anything back. It linked Microsoft's side-by-side
  setup: `@typescript/native` for `tsc`, `typescript` aliased to TS 6 for tools.
- Running CI's whole path locally: frozen install, verify, Worker build, startup gate.
- knip's list checked by hand. `robots.tsx`, `sitemap.tsx` and the Worker stub are used
  through conventions it cannot see.

## Rules

- Drop the `typescript` alias once typescript-eslint supports TS 7, and move
  `scripts/i18n-deep.mjs` off the old API at the same time.
- A test count that drops is a failure even if the rest looks fine: 1,113 of 1,167 meant
  a whole suite died on load.
- `minimumReleaseAge: 0` is deliberate. Removing it restores pnpm's delay.
