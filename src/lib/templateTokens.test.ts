import { describe, expect, it } from 'vitest'
import { splitTemplateTokens } from './templateTokens'

describe('splitTemplateTokens', () => {
  it('marks only {word} tokens', () => {
    expect(splitTemplateTokens('Set it — {date}, {title} — once')).toEqual([
      { token: false, text: 'Set it — ' },
      { token: true, text: '{date}' },
      { token: false, text: ', ' },
      { token: true, text: '{title}' },
      { token: false, text: ' — once' },
    ])
  })

  it('leaves copy with no tokens as one plain part', () => {
    expect(splitTemplateTokens('No tokens {here too')).toEqual([{ token: false, text: 'No tokens {here too' }])
  })
})
