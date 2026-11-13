import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveBlob } from './blobSaver'

describe('saveBlob', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps its own programmatic click out of autocapture', () => {
    // PostHog read three gallery saves in ~1 s as a visitor's rage click.
    const clicked: Array<{ className: string; download: string }> = []
    const link = {
      href: '',
      download: '',
      className: '',
      click() {
        clicked.push({ className: this.className, download: this.download })
      },
    }
    vi.stubGlobal('document', {
      createElement: () => link,
      body: { appendChild: () => {}, removeChild: () => {} },
    })
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })

    saveBlob(new Blob(['x']), 'post_03.jpg')

    expect(clicked).toEqual([{ className: 'ph-no-capture', download: 'post_03.jpg' }])
  })
})
