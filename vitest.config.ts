import { defineConfig } from 'vitest/config'

// Only the pure modules are tested here: offer selection, license tokens, and
// the batch queue. Components and the extractors are covered by `pnpm lint &&
// pnpm build` plus scripts/cf-smoke.mjs, so there is no jsdom environment and
// no React plugin to keep the runner instant.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
