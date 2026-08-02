import { describe, expect, it } from 'vitest'
import { mergePrefs, normalisePrefs } from './prefs'

describe('normalisePrefs', () => {
  it('accepts a well-formed object', () => {
    expect(normalisePrefs({ quality: 'sd', format: 'audio' })).toEqual({
      quality: 'sd',
      format: 'audio',
    })
  })

  it('accepts a JSON string, which is how the column is stored', () => {
    expect(normalisePrefs('{"quality":"sd","format":"video"}')).toEqual({
      quality: 'sd',
      format: 'video',
    })
  })

  it('fills a missing field with the default rather than rejecting', () => {
    expect(normalisePrefs({ quality: 'sd' })).toEqual({ quality: 'sd', format: 'video' })
  })

  it('rejects an unknown quality', () => {
    expect(normalisePrefs({ quality: '4k', format: 'video' })).toBeNull()
  })

  it('rejects an unknown format', () => {
    expect(normalisePrefs({ quality: 'hd', format: 'gif' })).toBeNull()
  })

  it('returns null for null', () => {
    expect(normalisePrefs(null)).toBeNull()
  })

  it('returns null for malformed JSON rather than throwing', () => {
    expect(normalisePrefs('{not json')).toBeNull()
  })
})

describe('mergePrefs', () => {
  const local = { quality: 'sd', format: 'audio' } as const

  it('pushes local preferences up on a first login', () => {
    expect(mergePrefs(local, null)).toEqual(local)
  })

  it('lets the server win once it has values', () => {
    const server = { quality: 'hd', format: 'video' } as const
    expect(mergePrefs(local, server)).toEqual(server)
  })
})
