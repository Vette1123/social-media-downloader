import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { brandMarkSvg, checkoutMarkSvg } from './brandMark'

// The committed SVGs are build outputs of brandMark.ts (`pnpm icons`). A
// hand edit to either, or new art here without re-running the script, would
// put two different marks in front of people.
const read = (name: string) => readFileSync(join(process.cwd(), 'public', name), 'utf8')

describe('the brand mark files', () => {
  it('favicon.svg is what brandMark renders', () => {
    expect(read('favicon.svg')).toBe(brandMarkSvg())
  })

  it('checkout-mark.svg is what brandMark renders', () => {
    expect(read('checkout-mark.svg')).toBe(checkoutMarkSvg())
  })

  it('the maskable mark keeps the bubble inside the 80% safe zone', () => {
    expect(brandMarkSvg({ maskable: true })).toMatch(/scale\(0\.8\)/)
    expect(brandMarkSvg({ maskable: true })).toContain('rx="0"')
  })
})
