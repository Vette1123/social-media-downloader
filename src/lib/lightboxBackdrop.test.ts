import { describe, expect, it } from 'vitest'

import { closesLightbox } from './lightboxBackdrop'

// A node environment has no DOM: an element is anything with `closest`, answering from the
// attributes on its own ancestry.
const el = (insideKeep: boolean) => ({
  closest: (selector: string) =>
    insideKeep && selector === '[data-lightbox-keep]' ? {} : null,
})

describe('closesLightbox', () => {
  it('a click on the backdrop closes it', () => {
    expect(closesLightbox(el(false), false)).toBe(true)
  })

  it('a click on a bar or the media (inside data-lightbox-keep) does not', () => {
    expect(closesLightbox(el(true), false)).toBe(false)
  })

  it('the click a drag ends with does not', () => {
    expect(closesLightbox(el(false), true)).toBe(false)
  })
})
