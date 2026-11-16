// Copy each of our apps' real launcher icon into public/apps/<slug>.webp,
// downscaled for a 40px slot at dpr 3, for the footer's "Our apps" menu and
// its Reely link. Ported from Reely's scripts/build-companion-icons.mjs, with
// one change: the source path is listed per app, because Masareef's Expo
// project sits one folder deeper (masareef/masareef-app) and Reely's
// `<slug>/assets/images/icon.png` guess throws on it.
//
// Run: pnpm apps:icons [path-to-the-Personal-folder]
//      default: ../.. (this repo lives at Personal/Next/<repo>)

import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const SIZE = 120
const root = resolve(process.argv[2] ?? '../..')
const outDir = join('public', 'apps')

const SOURCES = {
  rafiq: 'React Native/rafiq/assets/images/icon.png',
  masareef: 'React Native/masareef/masareef-app/assets/images/icon.png',
  nafis: 'React Native/nafis/assets/images/icon.png',
  // Reely is a website; its launcher icon is the PWA's.
  reely: 'Next/movies-streaming-platform/public/android-chrome-512x512.png',
}

// Every app the menu lists must have a source here, so a new one cannot ship
// with a missing icon.
const listed = [...readFileSync('src/lib/apps.ts', 'utf8').matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1])
if (!listed.length) throw new Error('found 0 apps in src/lib/apps.ts')
const missing = listed.filter((slug) => !SOURCES[slug])
if (missing.length) throw new Error(`no icon source for ${missing.length} app(s): ${missing.join(', ')}`)

mkdirSync(outDir, { recursive: true })
for (const [slug, rel] of Object.entries(SOURCES)) {
  const src = join(root, rel)
  if (!existsSync(src)) throw new Error(`${slug}: no icon at ${src}`)
  const out = join(outDir, `${slug}.webp`)
  const info = await sharp(src).resize(SIZE, SIZE).webp({ quality: 88 }).toFile(out)
  console.log(`${slug}: ${src} -> ${out} (${info.size} bytes)`)
}
console.log(`wrote ${Object.keys(SOURCES).length} icons at ${SIZE}px`)
