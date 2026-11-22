/**
 * Keeps the installed-PWA icon in step with the art.
 *
 * Browsers that install a PWA (Chrome's WebAPK, Edge, Samsung Internet,
 * desktop installs) only refresh the home-screen icon when an icon URL in the
 * manifest changes. They never re-download the same URL to see whether the
 * art changed. So every art change must come with a new `?v=`, and forgetting
 * one leaves installed apps on the old icon forever.
 *
 * src/lib/iconVersion.json pins the version and a fingerprint of every file
 * that draws the icon. src/lib/appIcon.test.ts fails when the art changes
 * without a bump.
 *
 *   pnpm icons:bump    after changing the art: next version, manifest ?v=, new fingerprint
 *   node scripts/icon-version.mjs    print the state; exit 1 when a bump is due
 *
 * Limit: browsers with no WebAPK (Firefox, Brave and other non-Chrome
 * Chromium builds on Android, iOS Safari) add a plain shortcut that never
 * updates. Those users have to re-add the app; no site can change that.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

/** Every file whose bytes decide what the icon looks like. */
export const ICON_ART_FILES = [
  'src/lib/brandMark.ts',
  'src/lib/appIcon.tsx',
  'public/favicon.svg',
  'public/favicon.ico',
]

const VERSION_FILE = 'src/lib/iconVersion.json'
const MANIFEST_FILE = 'public/manifest.json'

/**
 * sha256 over the art files, first 16 hex chars. Text files are hashed with LF
 * line endings so a Windows checkout and CI's Linux checkout agree.
 */
export function iconArtFingerprint(root = ROOT) {
  const hash = createHash('sha256')
  for (const file of ICON_ART_FILES) {
    let bytes = readFileSync(join(root, file))
    if (!file.endsWith('.ico')) bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))
    hash.update(file).update('\0').update(bytes).update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

export function readIconVersion(root = ROOT) {
  return JSON.parse(readFileSync(join(root, VERSION_FILE), 'utf8'))
}

/** Rewrites every `?v=<old>` on a manifest icon src to `?v=<next>`; returns how many moved. */
export function bumpManifestIcons(manifestText, oldVersion, nextVersion) {
  let moved = 0
  const text = manifestText.replace(
    new RegExp(String.raw`("src":\s*"[^"]*\?v=)${oldVersion}(")`, 'g'),
    (_, head, tail) => {
      moved++
      return `${head}${nextVersion}${tail}`
    },
  )
  return { text, moved }
}

function main() {
  const current = readIconVersion()
  const fingerprint = iconArtFingerprint()

  if (!process.argv.includes('--bump')) {
    const due = fingerprint !== current.art
    console.log(
      `icon version ${current.version}; art ${fingerprint}, pinned ${current.art}: ${due ? 'BUMP DUE, run pnpm icons:bump' : 'in step'}`,
    )
    process.exit(due ? 1 : 0)
  }

  const next = String(Number(current.version) + 1)
  const manifestPath = join(ROOT, MANIFEST_FILE)
  const { text, moved } = bumpManifestIcons(readFileSync(manifestPath, 'utf8'), current.version, next)
  if (moved === 0) {
    console.error(`no manifest icon carries ?v=${current.version}; fix ${MANIFEST_FILE} by hand first`)
    process.exit(1)
  }
  writeFileSync(manifestPath, text)
  writeFileSync(
    join(ROOT, VERSION_FILE),
    `${JSON.stringify({ version: next, art: fingerprint }, null, 2)}\n`,
  )
  console.log(`icon version ${current.version} -> ${next}: ${moved} manifest icon srcs moved, art ${fingerprint}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main()
