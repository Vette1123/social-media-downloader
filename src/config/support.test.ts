import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { PRO_EMAIL, proMailto } from './support'

// The old payment provider suspended the account on 2026-11-06. Every link to
// it now sends a supporter to a dead page, so nothing live may name it.
// lessons/ and migrations/ are history and stay as written.
const BANNED = /buymeacoffee|buy me a coffee|\/api\/billing\/bmc|BMC_WEBHOOK|bmc-https-robot|#bmc-/i
const HISTORY = /^(lessons|migrations)\//
const SELF = 'src/config/support.test.ts'

describe('the suspended payment provider is gone', () => {
  it('no tracked file outside history names it', () => {
    const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f && !HISTORY.test(f) && f !== SELF)
      .filter((f) => !/\.(png|jpe?g|webp|avif|ico|zip|woff2?|mp4)$/.test(f))
    const hits = files.filter((f) => {
      try {
        return BANNED.test(readFileSync(f, 'utf8'))
      } catch {
        return false
      }
    })
    expect(hits).toEqual([])
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
