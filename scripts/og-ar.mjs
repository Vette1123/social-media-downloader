#!/usr/bin/env node
/**
 * Draw the Arabic share cards in Chrome and commit them as PNGs.
 *
 *   pnpm og:ar
 *
 * Satori (next/og) shapes Arabic letters but lays a right-to-left line out
 * left-to-right, and Noto Sans Arabic does not load in it at all (2026-11-11).
 * Chrome does both right. So the SAME card element the other languages render
 * through satori (`homeOgCard`, `platformOgCard`) is rendered to static markup
 * here, opened in headless Chrome with `dir="rtl"`, and screenshotted to
 * `src/og/ar/<name>.png`, which the `[lang]` image routes serve for `ar`.
 *
 * `src/og/ar/manifest.json` records a hash of the words on each card;
 * `src/lib/arOgCards.test.ts` fails when the Arabic copy changes and this was
 * not re-run.
 *
 * ponytail: the font is whatever Chrome resolves for 'Segoe UI' / Tahoma —
 * Windows has both with Arabic. On another OS, point CHROME at a Chrome and
 * expect a different face; the test only guards the words, not the look.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { createViteServer } from 'vitest/node'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(root, 'src', 'og', 'ar')
const CHROME =
  process.env.CHROME ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].find((p) => existsSync(p))
if (!CHROME) throw new Error('No Chrome found. Set CHROME=<path to chrome>.')

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
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { homeOgCard } = await vite.ssrLoadModule('/src/lib/homeOgImage.tsx')
  const { platformOgCard } = await vite.ssrLoadModule('/src/lib/platformOgImage.tsx')
  const { PLATFORM_SLUGS } = await vite.ssrLoadModule('/src/lib/platformSlugs.ts')
  const { arOgCopyHash } = await vite.ssrLoadModule('/src/lib/arOgCards.ts')

  const cards = [
    { name: 'home', element: homeOgCard('ar') },
    ...PLATFORM_SLUGS.map((slug) => ({ name: slug, element: platformOgCard(slug, 'ar') })),
  ]

  mkdirSync(outDir, { recursive: true })
  const scratch = mkdtempSync(join(tmpdir(), 'og-ar-'))
  const manifest = {}
  for (const { name, element } of cards) {
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#050506}
body{font-family:'Segoe UI',Tahoma,sans-serif;color:#fff}div{text-wrap:balance}
/* The headline's 1.02 leading is for Latin caps; Arabic ascenders and descenders need room. */
div[style*="font-weight:800"]{line-height:1.32!important;padding-bottom:6px}
</style></head><body>${renderToStaticMarkup(element)}</body></html>`
    const page = join(scratch, `${name}.html`)
    const png = join(outDir, `${name}.png`)
    writeFileSync(page, html)
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1200,630',
      `--screenshot=${png}`,
      pathToFileURL(page).href,
    ], { stdio: 'ignore' })
    // Chrome writes a lossless 600 KB PNG; link unfurlers (WhatsApp above all)
    // drop big previews. A 256-colour palette keeps the gradients and halves
    // it twice over, about what satori ships for the other languages.
    writeFileSync(png, await sharp(readFileSync(png)).png({ palette: true, quality: 90, effort: 10 }).toBuffer())
    const bytes = readFileSync(png)
    if (bytes.length > 300 * 1024) {
      throw new Error(`${name}.png is ${(bytes.length / 1024).toFixed(0)} KB, over the 300 KB unfurl budget`)
    }
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    if (width !== 1200 || height !== 630) {
      throw new Error(`${name}.png is ${width}x${height}, expected 1200x630`)
    }
    manifest[name] = arOgCopyHash(name)
    console.log(`✓ ${name}.png  ${(bytes.length / 1024).toFixed(0)} KB`)
  }
  rmSync(scratch, { recursive: true, force: true })
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`${cards.length} Arabic cards drawn by ${CHROME}`)
} finally {
  await vite.close()
}
