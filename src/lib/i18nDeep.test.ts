import { describe, expect, it, vi } from 'vitest'
import { failureLine, failureTitle } from '@/lib/errorMessages'
import { d, deepWordsReady, dKnown, dn, loadDeepWords, setActive } from '@/lib/i18nDeep'

vi.mock('@/content/locales/deep/pt.json', () => {
  throw new Error('chunk failed')
})
vi.mock('@/content/locales/deep/es.json', () => ({
  default: {
    '{n} links saved': '{n} enlaces guardados',
    'Known text': 'Texto conocido',
    'Couldn’t process this link': 'No se pudo procesar',
    'Something went wrong resolving the media. Try again in a moment.': 'Inténtalo de nuevo.',
  },
}))

describe('rare sentences', () => {
  it('is English until the language lands, then speaks it', async () => {
    setActive('es')
    expect(deepWordsReady('es')).toBe(false)
    expect(d('{n} links saved', { n: 2 })).toBe('2 links saved')
    await loadDeepWords('es')
    expect(deepWordsReady('es')).toBe(true)
    expect(d('{n} links saved', { n: 2 })).toBe('2 enlaces guardados')
    expect(dKnown(dn('Known text'))).toBe('Texto conocido')
  })

  it('never shows raw server text on a translated page', () => {
    expect(failureTitle('upstream exploded')).toBe('No se pudo procesar')
    expect(failureLine('upstream exploded')).toBe('No se pudo procesar — Inténtalo de nuevo.')
    setActive('en')
    expect(failureTitle('upstream exploded')).toBe('upstream exploded')
    expect(failureLine('upstream exploded')).toContain('upstream exploded')
    setActive('es')
  })

  it('stops waiting when a language cannot load', async () => {
    await loadDeepWords('pt')
    expect(deepWordsReady('pt')).toBe(true)
  })

  it('shows text no dictionary has, as the server sent it', () => {
    expect(dKnown('Upstream said no')).toBe('Upstream said no')
  })
})
