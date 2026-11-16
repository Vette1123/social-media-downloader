import { describe, expect, it } from 'vitest'
import {
  BOT_COPY,
  BOT_DESCRIPTION_MAX,
  BOT_NAME_MAX,
  BOT_SHORT_DESCRIPTION_MAX,
  botCopyFor,
} from './telegramCopy'
import { LOCALES } from './i18n'

describe('the bot profile copy', () => {
  // Telegram rejects the whole setMy* call past these, so setup would fail.
  it.each(LOCALES)('%s fits Telegram limits', (locale) => {
    const copy = BOT_COPY[locale]
    expect(copy.name.length).toBeLessThanOrEqual(BOT_NAME_MAX)
    expect(copy.shortDescription.length).toBeLessThanOrEqual(BOT_SHORT_DESCRIPTION_MAX)
    expect(copy.description.length).toBeLessThanOrEqual(BOT_DESCRIPTION_MAX)
    expect(copy.description).toContain('socialdownloader.space')
  })

  it('maps Telegram language codes to a site locale', () => {
    expect(botCopyFor('pt-br')).toBe(BOT_COPY.pt)
    expect(botCopyFor('AR')).toBe(BOT_COPY.ar)
    expect(botCopyFor('de')).toBe(BOT_COPY.en)
    expect(botCopyFor(undefined)).toBe(BOT_COPY.en)
  })
})
