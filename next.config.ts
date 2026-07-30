import path from 'node:path'
import type { NextConfig } from 'next'

/**
 * Cloudflare Workers builds swap the native-binary packages for a stub.
 *
 * workerd has neither subprocesses nor a writable filesystem, so yt-dlp and
 * ffmpeg can never run there — the routes that use them already return 501 on
 * that target (see src/lib/nativeMedia.ts). What remains is making sure their
 * code never reaches the bundle, and neither of the two obvious options does
 * that on its own:
 *
 *   - Listing them in `serverExternalPackages` keeps Next from bundling them,
 *     but then the tracer keeps them on disk and the OpenNext bundler symlinks
 *     them into the Worker — ~10 MB of unreachable binaries against a 3 MiB
 *     gzip limit, and an outright EPERM failure on Windows, where symlinks need
 *     Developer Mode or elevation.
 *   - Dropping them from `serverExternalPackages` makes Next bundle them, and
 *     @ffmpeg-installer resolves its platform binary via dynamic require, so
 *     the build dies on module-not-found.
 *
 * Aliasing to the stub resolves both: Next bundles a few inert lines, nothing
 * is traced as external, and nothing gets symlinked. The wrangler `alias` entry
 * covers the same packages for the final esbuild pass.
 *
 * Set by the preview/deploy/upload scripts and by the deploy workflow.
 */
const isCloudflare = process.env.DEPLOY_TARGET === 'cloudflare'

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

const nextConfig: NextConfig = {
  // Everywhere except Cloudflare (local dev, any Node host), keep these native
  // / dynamic-require packages out of the server bundle so their runtime
  // `require()` calls resolve from node_modules instead of being traced at
  // build time.
  serverExternalPackages: isCloudflare ? [] : NATIVE_MEDIA_PACKAGES,

  // Turbopack drives `next build` on Next 16.
  ...(isCloudflare
    ? { turbopack: { resolveAlias: stubAliases(STUB) } }
    : {}),

  // Mirrored for the `--webpack` opt-out, so both builders agree.
  ...(isCloudflare
    ? {
        webpack: (config: {
          resolve: { alias?: Record<string, unknown> }
        }) => {
          config.resolve.alias = {
            ...config.resolve.alias,
            ...stubAliases(STUB_ABSOLUTE),
          }
          return config
        },
      }
    : {}),
}

export default nextConfig
