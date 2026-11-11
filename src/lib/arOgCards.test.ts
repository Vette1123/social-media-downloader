import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { arOgCardPath, arOgCopyHash, type ArOgCardName } from '@/lib/arOgCards'
import { PLATFORM_SLUGS } from '@/lib/platformSlugs'

/**
 * The Arabic share cards are committed PNGs (satori mis-orders RTL words), so
 * nothing at build time redraws them. This is what keeps them honest: every
 * card exists, is a 1200x630 PNG small enough to unfurl, and was drawn from the
 * Arabic copy the site ships today. Changed the copy? Run `pnpm og:ar`.
 */
const NAMES: ArOgCardName[] = ['home', ...PLATFORM_SLUGS]
const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'og', 'ar', 'manifest.json'), 'utf8'),
) as Record<string, string>

describe('the Arabic share cards', () => {
  it.each(NAMES)('%s is a committed 1200x630 PNG under 300 KB', (name) => {
    const png = readFileSync(arOgCardPath(name))
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
    expect(png.length).toBeLessThan(300 * 1024)
  })

  it.each(NAMES)('%s was drawn from the current Arabic copy (else: pnpm og:ar)', (name) => {
    expect(manifest[name]).toBe(arOgCopyHash(name))
  })

  it('has no card the site no longer has', () => {
    expect(Object.keys(manifest).sort()).toEqual([...NAMES].sort())
  })
})
