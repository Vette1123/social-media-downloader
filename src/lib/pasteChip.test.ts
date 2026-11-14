import { afterEach, describe, expect, it, vi } from 'vitest'
import { clipboardReadDenied, emptySubmitReadsClipboard, pasteDeniedKey } from './pasteChip'

afterEach(() => vi.unstubAllGlobals())

const withPermission = (query: () => Promise<{ state: string }>) =>
  vi.stubGlobal('navigator', { permissions: { query } })

describe('pasteDeniedKey', () => {
  it('names the keyboard shortcut with a mouse and the long-press on touch', () => {
    expect(pasteDeniedKey(true)).toBe('errorClipboard')
    expect(pasteDeniedKey(false)).toBe('errorLongPress')
  })
})

describe('clipboardReadDenied', () => {
  it('is true only for a remembered denial', async () => {
    withPermission(async () => ({ state: 'denied' }))
    expect(await clipboardReadDenied()).toBe(true)
    withPermission(async () => ({ state: 'prompt' }))
    expect(await clipboardReadDenied()).toBe(false)
  })

  it('keeps the chip where the browser cannot answer', async () => {
    withPermission(async () => {
      throw new TypeError('clipboard-read is not a valid permission name')
    })
    expect(await clipboardReadDenied()).toBe(false)
    vi.stubGlobal('navigator', {})
    expect(await clipboardReadDenied()).toBe(false)
  })
})

describe('emptySubmitReadsClipboard', () => {
  it('pastes for the visitor unless the browser already refused', () => {
    expect(emptySubmitReadsClipboard(true, false)).toBe(true)
    expect(emptySubmitReadsClipboard(true, true)).toBe(false)
    expect(emptySubmitReadsClipboard(false, false)).toBe(false)
  })
})
