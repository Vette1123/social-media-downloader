# Dependabot: vite and minimatch (dev-only)

## What

Six open alerts, all dev-only transitives. vite <=8.1.5 (via vitest) cleared by bumping vitest to 5.1.0 (vite 8.3.7). minimatch >=7 <11.0.1 (via eslint's `@eslint/config-array`, which still pins `^10`) cleared by a scoped `overrides` entry in `pnpm-workspace.yaml` forcing `^11.0.1`. Lint, typecheck and 1245 tests pass.

## Mistakes

None worth recording; `pnpm update vite vitest --depth Infinity` also refreshed wrangler within its range, which is harmless.

## Rules

- When the advisory's patched version is a major the parent doesn't allow, override only the vulnerable range (`'pkg@>=7 <11.0.1'`), not the package name, so unaffected copies (minimatch 3.x here) are left alone. Mark it `ponytail:` with the condition for removing it.
