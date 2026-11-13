import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The FAQ's native <details> fallback must stay on screen until the accordion's
// module has arrived. Swapping on a flag (next/dynamic with an empty `loading`
// slot) blanked the whole FAQ while the chunk downloaded: a 1,100 px layout
// shift under anyone scrolling toward it. No DOM in this suite, so the seam is
// the source: the swap is driven by the resolved module, never by a boolean.
const src = readFileSync(new URL('./LazyFAQ.tsx', import.meta.url), 'utf8')

describe('LazyFAQ swap', () => {
  it('does not mount the accordion through a loading slot', () => {
    expect(src).not.toMatch(/from 'next\/dynamic'/)
    expect(src).not.toMatch(/loading:\s*\(\)\s*=>\s*null/)
  })
  it('swaps only once the module has resolved', () => {
    expect(src).toMatch(/loadInteractiveFAQ\(\)\s*\.then\(\(faq\) => setInteractive\(\(\) => faq\)\)/)
    expect(src).toMatch(/\{!Interactive && \(/)
  })
})
