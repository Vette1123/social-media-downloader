import { describe, expect, it } from 'vitest'
import { shouldDropException } from './analyticsNoise'
import { missingChunkPath, shouldReload } from './staleChunk'

// The exact message PostHog captured on 17 Nov (Turbopack's wording).
const TURBOPACK = 'Failed to load chunk /_next/static/chunks/18qefgeb8g7ds.js from module 69585'

describe('missingChunkPath', () => {
  it('reads the chunk path from the Turbopack message, string or Error', () => {
    expect(missingChunkPath(TURBOPACK)).toBe('/_next/static/chunks/18qefgeb8g7ds.js')
    expect(missingChunkPath(new Error(TURBOPACK))).toBe('/_next/static/chunks/18qefgeb8g7ds.js')
  })

  it('reads webpack-style CSS chunk failures', () => {
    expect(
      missingChunkPath('Loading CSS chunk 12 failed. (https://x.test/_next/static/css/ab12.css)'),
    ).toBe('/_next/static/css/ab12.css')
  })

  it('ignores other errors and foreign chunks', () => {
    expect(missingChunkPath(new Error('TypeError: x is undefined'))).toBeNull()
    expect(missingChunkPath('Failed to load chunk https://cdn.other.test/a.js')).toBeNull()
    expect(missingChunkPath(null)).toBeNull()
  })
})

describe('shouldReload', () => {
  const path = '/_next/static/chunks/a.js'
  it('reloads once when the chunk is gone', () => {
    expect(shouldReload(404, path, null)).toBe(true)
    expect(shouldReload(404, path, path)).toBe(false)
  })
  it('leaves the page alone when the chunk is still there', () => {
    expect(shouldReload(200, path, null)).toBe(false)
  })
})

it('the Turbopack chunk failure is dropped as deploy noise', () => {
  expect(
    shouldDropException({ properties: { $exception_list: [{ type: 'Error', value: TURBOPACK }] } }),
  ).toBe(true)
})
