import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_ICON_SLUGS } from './AppIcon'
import { PLAY_APPS } from '@/lib/apps'

// The menu, the hero's app cards and the Reely link show public/apps/<slug>.webp.
// A missing file is a broken-image box beside the app's name, so every app the
// site lists must have one (`pnpm apps:icons` writes them).
describe('app icons', () => {
  it('every listed app has a launcher icon', () => {
    for (const app of PLAY_APPS) expect(APP_ICON_SLUGS).toContain(app.slug)
  })

  it.each(APP_ICON_SLUGS)('public/apps/%s.webp exists', (slug) => {
    expect(existsSync(join(process.cwd(), 'public', 'apps', `${slug}.webp`))).toBe(true)
  })
})
