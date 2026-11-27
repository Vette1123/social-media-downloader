import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { panelBenefits, PRO_EMAIL, proMailto } from './support'

// The old payment provider suspended the account on 2026-11-06. Every link to
// it now sends a supporter to a dead page, so nothing live may name it.
// lessons/ and migrations/ are history and stay as written.
const BANNED =
  'buymeacoffee|buy me a coffee|/api/billing/bmc|BMC_WEBHOOK|bmc-https-robot|#bmc-'
const HISTORY = [':!lessons', ':!migrations']
const SELF = 'src/config/support.test.ts'

/** Tracked text files outside history that match `pattern` (case-insensitive). */
function trackedHits(pattern: string): string[] {
  // git grep, not a readFileSync walk over `git ls-files`: -I skips binaries by
  // content. The walk took 11.7 s and timed out under a full suite (27 Nov).
  const run = spawnSync(
    'git',
    ['grep', '-l', '-I', '-i', '-E', pattern, '--', '.', ...HISTORY, `:!${SELF}`],
    { encoding: 'utf8' }
  )
  // Exit 1 is "no match"; above 1 is a real error, which must not pass as clean.
  expect(run.status, run.stderr).not.toBeGreaterThan(1)
  return run.stdout.split('\n').filter(Boolean)
}

describe('the suspended payment provider is gone', () => {
  it('no tracked file outside history names it', () => {
    expect(trackedHits(BANNED)).toEqual([])
  })

  it('the scan finds a name that is there', () => {
    // Guards the guard: a broken pathspec or flag would pass the test above vacuously.
    expect(trackedHits('proMailto')).not.toEqual([])
  })
})

describe('proMailto', () => {
  it('addresses the Pro inbox with an encoded subject and body', () => {
    const href = proMailto('Lifetime', 'a+b@example.com')
    expect(href.startsWith(`mailto:${PRO_EMAIL}?subject=`)).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('subject')).toBe('Downloader supporter — Lifetime')
    expect(params.get('body')).toContain('a+b@example.com')
  })

  it('leaves the sign-in address blank for the sender to fill when unknown', () => {
    const params = new URLSearchParams(proMailto('Monthly or yearly').split('?')[1])
    expect(params.get('body')).toContain('The email I sign in with: \n')
  })
})

describe('panelBenefits', () => {
  it('shows exactly the four the copy promises, in every locale', async () => {
    const { LOCALES } = await import('@/lib/i18n')
    const { contentFor } = await import('@/lib/localeContent')
    for (const locale of LOCALES) {
      const { support } = contentFor(locale).copy
      expect(panelBenefits(support.benefits)).toHaveLength(4)
      expect(support.benefits.length).toBeGreaterThan(4)
    }
  })
})
