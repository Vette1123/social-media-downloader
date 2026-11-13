import { describe, expect, it } from 'vitest'
import { CHECK_STEP, lastCheckedSha, touchesLayout } from './layout-changed.mjs'

describe('touchesLayout', () => {
  it('skips a push of only docs, lessons, tests, tooling and side workflows', () => {
    expect(
      touchesLayout([
        'README.md',
        'lessons/README.md',
        'scripts/expire-sponsors.mjs',
        'src/lib/promo.test.ts',
        '.github/workflows/expire-sponsors.yml',
        '.github/FUNDING.yml',
      ]),
    ).toEqual([])
  })

  it('runs for any source, style, config or offer change', () => {
    expect(touchesLayout(['README.md', 'src/config/offers.ts'])).toEqual(['src/config/offers.ts'])
    expect(touchesLayout(['src/app/globals.css', 'package.json'])).toHaveLength(2)
  })

  it('runs when the audit or the deploy workflow itself changes', () => {
    expect(touchesLayout(['scripts/cls-audit.mjs'])).toEqual(['scripts/cls-audit.mjs'])
    expect(touchesLayout(['scripts/cf-postbuild.mjs', 'scripts/headerRules.mjs'])).toHaveLength(2)
    expect(touchesLayout(['.github/workflows/deploy-cloudflare.yml'])).toHaveLength(1)
  })

  it('treats nested script folders as source, since app code imports some of them', () => {
    expect(touchesLayout(['scripts/lib/shared.mjs'])).toEqual(['scripts/lib/shared.mjs'])
  })
})

describe('lastCheckedSha', () => {
  const run = (sha, conclusion) => ({
    head_sha: sha,
    jobs: [{ steps: [{ name: 'Build static site', conclusion: 'success' }, { name: CHECK_STEP, conclusion }] }],
  })

  // 2026-11-13: a scheduled run superseded the push that changed the deploy
  // workflow, skipped the check, and the next push diffed from it.
  it('ignores runs that skipped the check, so a superseded push is still checked', () => {
    expect(lastCheckedSha([run('sched', 'skipped'), run('older', 'success')])).toBe('older')
  })

  it('returns null when no run in the window really checked, which means run', () => {
    expect(lastCheckedSha([run('a', 'skipped'), { head_sha: 'b', jobs: [] }])).toBeNull()
  })
})
