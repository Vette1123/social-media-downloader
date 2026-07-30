import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

/**
 * Cloudflare Workers build config for the OpenNext adapter.
 *
 * Both options below exist for one reason: the free plan allows 10 ms of CPU
 * per request, and without them this app blows that budget on its own pages.
 *
 * `incrementalCache: staticAssetsIncrementalCache`
 *   Every route here is prerendered at build time and none of them revalidate,
 *   so the build already emits finished bytes — HTML for the pages, PNG for the
 *   12 OpenGraph/Twitter images — into `.open-next/cache/<buildId>/`.
 *
 *   Being prerendered is NOT by itself enough to get them served: with no
 *   incremental cache configured, the Worker has nowhere to read that output
 *   from, so Next regenerates each response on demand. For the OG image routes
 *   that means re-running satori (SVG layout + rasterization) per request, which
 *   is far past 10 ms — every one of them returned `error code 1102` in
 *   production while passing locally, because `wrangler dev` does not enforce
 *   the CPU limit.
 *
 *   This override reads the prerendered entries back out of Workers Assets
 *   (the build copies them to `assets/cdn-cgi/_next_cache/`, a prefix only the
 *   Worker itself can fetch). It is read-only and rejects writes by design,
 *   which is exactly right here — nothing revalidates, and no R2 bucket or KV
 *   namespace has to be provisioned, so it stays free.
 *
 * `enableCacheInterception: true`
 *   Serves a cached route from the incremental cache *before* booting Next's
 *   server and router. That skips the bulk of the per-request CPU for the ~44
 *   prerendered routes, which are almost all of the traffic. Safe here only
 *   because this app does not use PPR (see next.config.ts) — the adapter warns
 *   that the two are incompatible.
 *
 * If a route ever gains `revalidate` or on-demand revalidation, this cache
 * cannot store the new render: swap in r2IncrementalCache and add the matching
 * `r2_buckets` binding in wrangler.jsonc, or the route will silently keep
 * serving its build-time output forever.
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,

  // Default, but pinned deliberately: preloading routes on a cold start trades
  // first-request latency for CPU, and CPU is the scarce resource on this plan.
  routePreloadingBehavior: 'none',
})
