import path from 'node:path'
import type { NextConfig } from 'next'

/**
 * `DEPLOY_TARGET=cloudflare` switches the build to a pure static export.
 *
 * Production is a static site on Cloudflare Workers: `next build` emits plain
 * HTML/CSS/JS/PNG into `out/`, wrangler uploads that as Workers Static Assets,
 * and the only server-side code left is cloudflare/worker.js handling /api/*.
 * Next.js does not run in production at all.
 *
 * That is what keeps the free plan comfortable. Static assets are matched
 * before the Worker is even invoked, so pages cost zero CPU against the 10 ms
 * per-request budget and are exempt from the 100k requests/day cap. The
 * previous setup ran the full Next server on workerd, whose lazy
 * initialization was billed to whichever request happened to trigger it —
 * measured at 76-129 ms, i.e. 8-13x over budget, recurring on every new
 * isolate rather than once per deploy.
 *
 * Set by the deploy workflow and by the cf:* scripts.
 */
const isStaticExport = process.env.DEPLOY_TARGET === 'cloudflare'

/**
 * Only `.tsx` counts as a route file in the static export, which is how
 * src/app/api/** stays out of it.
 *
 * A static export cannot contain Route Handlers that read the request (POST
 * bodies, query strings), and every /api/* route does. Those files still exist
 * and still work under `next dev` and on any Node host — they are thin
 * wrappers over src/lib/apiRoutes.ts, which is also what the Worker dispatches
 * from, so there is exactly one implementation either way.
 *
 * The convention this encodes: **API route handlers are `.ts`; everything the
 * static site is built from is `.tsx`.** That is why src/app/robots.tsx and
 * src/app/sitemap.tsx carry a `.tsx` extension despite containing no JSX —
 * with `.ts` they would be silently dropped from the export. Adding a new page
 * or metadata route means naming it `.tsx`; scripts/cf-verify-export.mjs fails
 * the build if the expected route set ever shrinks.
 */
const STATIC_PAGE_EXTENSIONS = ['tsx']

/**
 * Cloudflare builds swap the native-binary packages for a stub.
 *
 * workerd has neither subprocesses nor a writable filesystem, so yt-dlp and
 * ffmpeg can never run there — the routes that use them already return 501 on
 * that target (see src/lib/nativeMedia.ts). What remains is making sure their
 * code never reaches the bundle, and neither of the two obvious options does
 * that on its own:
 *
 *   - Listing them in `serverExternalPackages` keeps Next from bundling them,
 *     but then the tracer keeps them on disk — megabytes of unreachable
 *     binaries, and an outright EPERM failure on Windows, where the symlinks
 *     that pnpm's layout implies need Developer Mode or elevation.
 *   - Dropping them from `serverExternalPackages` makes Next bundle them, and
 *     @ffmpeg-installer resolves its platform binary via dynamic require, so
 *     the build dies on module-not-found.
 *
 * Aliasing to the stub resolves both. The wrangler `alias` entry does the same
 * for the Worker bundle, which is where these imports actually survive now
 * that the API handlers are compiled by esbuild rather than by Next.
 */
const NATIVE_MEDIA_PACKAGES = [
  'fluent-ffmpeg',
  '@ffmpeg-installer/ffmpeg',
  'youtube-dl-exec',
]

const STUB = './cloudflare/stubs/unavailable.js'
const STUB_ABSOLUTE = path.resolve(process.cwd(), 'cloudflare/stubs/unavailable.js')

function stubAliases<T>(value: T): Record<string, T> {
  return Object.fromEntries(NATIVE_MEDIA_PACKAGES.map((name) => [name, value]))
}

/** Config that only applies to the static Cloudflare build. */
const staticExportConfig = {
  output: 'export',
  pageExtensions: STATIC_PAGE_EXTENSIONS,

  // No image optimizer exists in a static export. Nothing here uses
  // next/image, but leaving this unset turns a future `<Image>` into a build
  // failure with a far less obvious message than a plain <img>.
  images: { unoptimized: true },

  // Turbopack drives `next build` on Next 16.
  turbopack: { resolveAlias: stubAliases(STUB) },

  // Mirrored for the `--webpack` opt-out, so both builders agree.
  webpack: (config: { resolve: { alias?: Record<string, unknown> } }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...stubAliases(STUB_ABSOLUTE),
    }
    return config
  },
} as const satisfies NextConfig

const nextConfig: NextConfig = {
  // Everywhere except the static build (local dev, any Node host), keep these
  // native / dynamic-require packages out of the server bundle so their
  // runtime `require()` calls resolve from node_modules instead of being
  // traced at build time.
  serverExternalPackages: isStaticExport ? [] : NATIVE_MEDIA_PACKAGES,

  ...(isStaticExport ? staticExportConfig : {}),
}

export default nextConfig
