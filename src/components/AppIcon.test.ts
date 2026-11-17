import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_ICON_SLUGS, appIconAlt } from './AppIcon'
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

  // Bing's URL Inspection flagged the seven empty alts on the homepage as an
  // SEO issue. The icon names its app for crawlers and image search, and stays
  // aria-hidden so a screen reader doesn't read the printed name twice.
  it('names the app in its alt text', () => {
    expect(appIconAlt('masareef')).toBe('Masareef app icon')
    for (const slug of APP_ICON_SLUGS) expect(appIconAlt(slug)).toMatch(/^[A-Z][a-z]+ app icon$/)
  })
})
