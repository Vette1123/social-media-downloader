#!/usr/bin/env node
/**
 * Render the satori share cards to PNGs you can open, without a dev server.
 *
 *   pnpm og:preview                      # home, pro and every platform, English
 *   pnpm og:preview instagram-downloader es
 *
 * Writes to OG_PREVIEW_DIR (default: <os tmp>/og-preview) and prints each path.
 * Arabic is not drawn here: its cards come from Chrome (`pnpm og:ar`).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createViteServer } from 'vitest/node'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = process.env.OG_PREVIEW_DIR || join(tmpdir(), 'og-preview')
const [only, locale = 'en'] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })

const vite = await createViteServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
  resolve: { alias: { '@': join(root, 'src') } },
  oxc: { jsx: { runtime: 'automatic' } },
})

try {
  const { renderHomeOgImage } = await vite.ssrLoadModule('/src/lib/homeOgImage.tsx')
  const { renderPlatformOgImage } = await vite.ssrLoadModule('/src/lib/platformOgImage.tsx')
  const { renderProOgImage } = await vite.ssrLoadModule('/src/lib/proOgImage.tsx')
  const { PLATFORM_SLUGS } = await vite.ssrLoadModule('/src/lib/platformSlugs.ts')
  const cards = [
    { name: 'home', render: () => renderHomeOgImage(locale) },
    { name: 'pro', render: () => renderProOgImage() },
    ...PLATFORM_SLUGS.map((slug) => ({ name: slug, render: () => renderPlatformOgImage(slug, locale) })),
  ].filter((card) => !only || card.name === only)
  if (cards.length === 0) throw new Error(`No card named "${only}".`)
  for (const card of cards) {
    const png = Buffer.from(await card.render().arrayBuffer())
    if (png.length < 10_000) throw new Error(`${card.name}: ${png.length} bytes, the render failed`)
    const file = join(outDir, `${card.name}-${locale}.png`)
    writeFileSync(file, png)
    console.log(`${file}  ${(png.length / 1024).toFixed(0)} KB`)
  }
} finally {
  await vite.close()
}
