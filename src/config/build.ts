import { execFileSync } from 'node:child_process'

// Single source of truth for "when was this site last updated".
//
// Evaluated once per build (both the sitemap and the JSON-LD graph are
// statically prerendered). The dates come from git, not the clock: a deploy
// happens several times a day and mostly changes no page, and Google stops
// trusting a lastmod that moves when the content did not. The deploy job checks
// out full history so this works; the build date is only the fallback.
//
// SOURCE_DATE_EPOCH (seconds) is honoured when present so reproducible builds
// can pin the value.
function resolveBuildDate(): Date {
  const epoch = process.env.SOURCE_DATE_EPOCH
  if (epoch) {
    const seconds = Number(epoch)
    if (Number.isFinite(seconds)) return new Date(seconds * 1000)
  }
  return new Date()
}

export const buildDate = resolveBuildDate()

/** When a page's source last changed in a commit. For sitemap `<lastmod>`. */
export function lastChanged(paths: readonly string[]): Date {
  try {
    const stamp = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', ...paths],
      { encoding: 'utf8' },
    ).trim()
    if (stamp) return new Date(stamp)
  } catch {
    // No git in this environment: fall through.
  }
  console.warn(`No git history for ${paths.join(', ')}; using the build date`)
  return buildDate
}

/** What every platform page is rendered from. */
export const PLATFORM_PAGE_SOURCES = [
  'src/lib/platforms.ts',
  'src/components/PlatformLanding.tsx',
] as const

/** What the homepage is rendered from. */
export const HOME_PAGE_SOURCES = [
  'src/app/page.tsx',
  'src/lib/homepageFaqs.ts',
] as const

/** `YYYY-MM-DD` — for schema.org `dateModified` on the application. */
export const contentDay = lastChanged([
  ...HOME_PAGE_SOURCES,
  ...PLATFORM_PAGE_SOURCES,
])
  .toISOString()
  .slice(0, 10)
