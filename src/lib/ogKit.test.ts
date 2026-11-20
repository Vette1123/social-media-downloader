import { describe, expect, it } from 'vitest'
import { orbitSlot } from '@/lib/homeOgImage'
import { cardActions, homeOgCopy } from '@/lib/ogCopy'
import { ogFonts, ogHeadlineSize, splitHeadline } from '@/lib/ogKit'
import { proCardPerks } from '@/lib/proOgImage'

describe('share card fonts', () => {
  // The 2026-11-20 "so bad" card: with no font handed to satori, every
  // 800-weight headline fell back to one thin built-in face.
  it('hands satori Geist at the heavy weight the headlines ask for', () => {
    const fonts = ogFonts()
    expect(fonts.map((f) => f.weight)).toEqual([400, 600, 800])
    for (const font of fonts) {
      expect(font.name).toBe('Geist')
      expect(font.data.byteLength).toBeGreaterThan(20_000)
    }
  })
})

describe('splitHeadline', () => {
  it('puts the promise after the dash on its own line', () => {
    expect(splitHeadline('Instagram Reels & Photo Downloader — Free, No Login')).toEqual([
      'Instagram Reels & Photo Downloader',
      'Free, No Login',
    ])
  })

  it('keeps a headline with no dash, or a hyphenated word, whole', () => {
    expect(splitHeadline('Descargar videos de LinkedIn: sin login')).toEqual([
      'Descargar videos de LinkedIn: sin login',
      '',
    ])
    expect(splitHeadline('Built-in downloader')).toEqual(['Built-in downloader', ''])
  })
})

describe('ogHeadlineSize', () => {
  it('shrinks as the statement grows so three lines still fit', () => {
    expect(ogHeadlineSize('Short')).toBeGreaterThan(ogHeadlineSize('A statement of thirty-odd chars'))
    expect(ogHeadlineSize('A statement of thirty-odd chars')).toBeGreaterThan(
      ogHeadlineSize('A very long translated statement that runs past forty characters'),
    )
  })
})

describe('home card', () => {
  it('splits the two-part headline and drops the lead comma', () => {
    const parts = homeOgCopy('es').parts
    expect(parts?.[0].endsWith(',')).toBe(false)
    expect(parts?.[1].length).toBeGreaterThan(0)
  })

  it('places the orbit tiles evenly, the first straight above the mark', () => {
    const top = orbitSlot(0, 6)
    const bottom = orbitSlot(3, 6)
    expect(top.left).toBe(bottom.left)
    expect(top.top).toBeLessThan(bottom.top)
  })
})

describe('card wording', () => {
  it('draws the button and toast in the card language', () => {
    expect(cardActions('es')).toEqual({ action: 'Descargar', saved: 'Guardado' })
    expect(cardActions('en')).toEqual({ action: 'Download', saved: 'Saved' })
  })

  it('lists only perks that exist in config/pro.ts', () => {
    expect(proCardPerks()).toHaveLength(4)
  })
})
