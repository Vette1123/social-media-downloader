import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ICON_VERSION, versionedIcon } from './appIcon'

/**
 * The icon version lives in two places that cannot import each other:
 * `ICON_VERSION` (TypeScript, used by layout.tsx) and public/manifest.json (a
 * static file the browser fetches). If someone bumps one and forgets the other,
 * the tab updates and the installed home-screen icon does not — or the reverse
 * — and the mismatch is invisible until a user complains about a stale icon
 * weeks later. So it is asserted here instead.
 */
const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'manifest.json'), 'utf8'),
) as {
  icons: Array<{ src: string }>
  shortcuts: Array<{ icons: Array<{ src: string }> }>
  background_color: string
  theme_color: string
}

function allManifestIconSrcs(): string[] {
  return [
    ...manifest.icons.map((i) => i.src),
    ...manifest.shortcuts.flatMap((s) => s.icons.map((i) => i.src)),
  ]
}

describe('versionedIcon', () => {
  it('appends the current version', () => {
    expect(versionedIcon('/icons/192')).toBe(`/icons/192?v=${ICON_VERSION}`)
  })
})

describe('manifest icon versioning', () => {
  it('has icons to check', () => {
    expect(allManifestIconSrcs().length).toBeGreaterThan(3)
  })

  it('stamps every manifest icon with the current ICON_VERSION', () => {
    const stale = allManifestIconSrcs().filter(
      (src) => !src.endsWith(`?v=${ICON_VERSION}`),
    )
    expect(stale).toEqual([])
  })

  it('keeps the splash background and theme colour in step', () => {
    // Android composes the PWA splash from background_color plus the 512 icon.
    // They are the same value on purpose: a theme_color that differs from the
    // splash background shows as a visible band under the status bar on launch.
    expect(manifest.background_color).toBe(manifest.theme_color)
  })
})
