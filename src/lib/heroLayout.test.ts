import { describe, expect, it } from 'vitest'

import { homeHeroChips, linkCardWidth } from './heroLayout'
import { contentFor } from './localeContent'

describe('hero link cards on a phone', () => {
  it('three apps share a row and drop the repeated icon', () => {
    expect(linkCardWidth('third').card).toContain('33.333%')
    expect(linkCardWidth('third').icon).toContain('hidden')
  })
  it('dev links keep half a row and their icon', () => {
    expect(linkCardWidth('half').card).toContain('50%')
    expect(linkCardWidth('half').icon).toBe('')
  })
})

describe('home hero checklist', () => {
  it('does not repeat the free / no account / no limits line above it', () => {
    const { chips } = contentFor('en').copy
    const shown = homeHeroChips(chips)
    expect(shown).not.toContain(chips.free)
    expect(shown).not.toContain(chips.noLoginToDownload)
    expect(shown).not.toContain(chips.noLimits)
    expect(shown.length).toBeGreaterThan(0)
  })
})
