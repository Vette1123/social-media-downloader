/**
 * End-to-end smoke test against a deployed Cloudflare Worker.
 *
 *   node scripts/cf-smoke.mjs                      test the workers.dev URL
 *   node scripts/cf-smoke.mjs https://example.com  test a specific origin
 *   node scripts/cf-smoke.mjs --passes 3           repeat the whole suite
 *   node scripts/cf-smoke.mjs --only api           run only checks matching a
 *                                                  substring — use right after
 *                                                  a deploy to exercise a route
 *                                                  on a genuinely cold isolate,
 *                                                  since anything run before it
 *                                                  warms the Next server
 *
 * Exists because `wrangler dev` does not enforce the free plan's 10 ms CPU
 * limit, so a route can pass locally and return `error code 1102` in
 * production — which is exactly what happened to all 24 OpenGraph/Twitter image
 * routes. Every assertion here therefore runs against the real deployment, and
 * 1101 (thrown exception) / 1102 (resource limit) are called out explicitly
 * rather than being lumped in with ordinary 5xx.
 *
 * Two passes by default: the first can hit a cold isolate, where Next's server
 * initialization is billed to the request that triggers it; the second confirms
 * the warm path. A failure on pass 1 only is still a failure — real users hit
 * cold isolates too.
 *
 * Exits non-zero if any check fails, so it can gate a deploy.
 */

const DEFAULT_BASE = 'https://social-media-downloader.mamamaya1337.workers.dev'

// Kept in sync with src/lib/platforms.ts by the sitemap check below, which
// fails if the deployed sitemap and this list disagree.
const PLATFORM_SLUGS = [
  'tiktok-downloader',
  'twitter-video-downloader',
  'instagram-downloader',
  'youtube-downloader',
  'facebook-downloader',
  'pinterest-downloader',
  'reddit-video-downloader',
  'threads-video-downloader',
  'snapchat-downloader',
  'twitch-clip-downloader',
  'vimeo-downloader',
]

const PNG_MAGIC = '89504e470d0a1a0a'
// A 1x1 transparent GIF on a host that is always reachable, used to exercise
// the media proxies without depending on a social platform staying up.
const PROXY_PROBE_IMAGE = 'https://www.google.com/favicon.ico'

const args = process.argv.slice(2)
const passesFlag = args.indexOf('--passes')
const PASSES = passesFlag === -1 ? 2 : Number(args[passesFlag + 1])
const onlyFlag = args.indexOf('--only')
const ONLY = onlyFlag === -1 ? null : args[onlyFlag + 1]
const BASE = (args.find((a) => a.startsWith('http')) ?? DEFAULT_BASE).replace(/\/+$/, '')
// Requests run a few at a time: enough to be quick, few enough that the Worker
// is not being deliberately stress-tested (which would prove nothing about the
// per-request CPU budget).
const CONCURRENCY = 6

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}

/** Cloudflare returns these as a plain-text body, not a structured error. */
function cloudflareErrorCode(text) {
  const match = text.match(/^error code: (\d+)$/m)
  return match ? match[1] : null
}

function describeCloudflareError(code) {
  if (code === '1102') return 'Worker exceeded resource limits (CPU over 10 ms)'
  if (code === '1101') return 'Worker threw an unhandled exception'
  if (code === '1027') return 'Worker daily request limit exceeded'
  return `Cloudflare Worker error ${code}`
}

// --- check definitions ----------------------------------------------------

/** An HTML document that actually rendered the app, not an error shell. */
function htmlPage(pathname, mustContain) {
  return {
    name: `page ${pathname}`,
    request: { pathname },
    check: async (response, body) => {
      if (response.status !== 200) return `expected 200, got ${response.status}`
      const type = response.headers.get('content-type') ?? ''
      if (!type.includes('text/html')) return `expected text/html, got "${type}"`
      const text = new TextDecoder().decode(body)
      if (!text.includes('</html>')) return 'body is not a complete HTML document'
      for (const needle of mustContain) {
        if (!text.includes(needle)) return `body is missing ${JSON.stringify(needle)}`
      }
      return null
    },
  }
}

/**
 * A prerendered image route. These are the ones that blew the CPU budget, so
 * the check insists on real PNG bytes — a 200 with an error body would
 * otherwise look like a pass.
 *
 * It also asserts the response came from Workers Assets rather than the Worker.
 * scripts/cf-static-assets.mjs promotes these to static assets so the Worker is
 * never invoked, and the `_headers` Cache-Control it writes is distinct from
 * the `max-age=0, must-revalidate` Next emits — so the header doubles as proof
 * of which path served the request.
 *
 * @param minBytes some prerendered icons are legitimately small; the social
 *   cards are ~500 KB and a tiny one means satori emitted an empty canvas.
 */
function pngImage(pathname, minBytes = 10_000) {
  return {
    name: `image ${pathname}`,
    request: { pathname },
    check: async (response, body) => {
      if (response.status !== 200) return `expected 200, got ${response.status}`
      const magic = Buffer.from(body.slice(0, 8)).toString('hex')
      if (magic !== PNG_MAGIC) return `not a PNG (first 8 bytes: ${magic})`
      if (body.byteLength < minBytes) {
        return `PNG is suspiciously small (${body.byteLength} bytes, expected >= ${minBytes})`
      }
      const cacheControl = response.headers.get('cache-control') ?? ''
      if (!cacheControl.includes('max-age=86400')) {
        return `served by the Worker, not Assets (cache-control: "${cacheControl}")`
      }
      const type = response.headers.get('content-type') ?? ''
      if (!type.includes('image/png')) return `expected image/png, got "${type}"`
      return null
    },
  }
}

function staticFile(pathname, expectedType, minBytes = 1) {
  return {
    name: `static ${pathname}`,
    request: { pathname },
    check: async (response, body) => {
      if (response.status !== 200) return `expected 200, got ${response.status}`
      const type = response.headers.get('content-type') ?? ''
      if (!type.includes(expectedType)) return `expected ${expectedType}, got "${type}"`
      if (body.byteLength < minBytes) return `body too small (${body.byteLength} bytes)`
      return null
    },
  }
}

/** A route whose native binaries cannot exist on workerd — must 501, not hang. */
function nativeMediaGuard(name, request) {
  return {
    name: `guard ${name}`,
    request,
    check: async (response, body) => {
      if (response.status !== 501) return `expected 501, got ${response.status}`
      const text = new TextDecoder().decode(body)
      if (!text.includes('{')) return 'expected a JSON explanation body'
      return null
    },
  }
}

function buildChecks() {
  const checks = [
    htmlPage('/', ['socialdownloader', '<main']),
    ...PLATFORM_SLUGS.map((slug) => htmlPage(`/${slug}`, ['<main'])),

    // Root cards plus one pair per platform: 24 generated images total.
    pngImage('/opengraph-image'),
    pngImage('/twitter-image'),
    ...PLATFORM_SLUGS.flatMap((slug) => [
      pngImage(`/${slug}/opengraph-image`),
      pngImage(`/${slug}/twitter-image`),
    ]),

    // PWA icons referenced by manifest.json — also prerendered, also promoted
    // to static assets. Smaller than the social cards, hence the lower floor.
    ...['192', '512', 'apple', 'maskable'].map((name) =>
      pngImage(`/icons/${name}`, 1_000),
    ),

    staticFile('/robots.txt', 'text/plain', 100),
    staticFile('/sitemap.xml', 'xml', 500),
    staticFile('/manifest.json', 'json', 100),
    staticFile('/favicon.svg', 'svg'),
    staticFile('/apple-touch-icon.svg', 'svg'),
    staticFile('/ads.txt', 'text/plain'),
    staticFile('/f62bfbe4672c27f2ad3204b176eaab35.txt', 'text/plain'),

    {
      // Guards against a silent drift between platforms.ts and this file, and
      // proves the sitemap is generated rather than stale.
      name: 'sitemap lists every platform',
      request: { pathname: '/sitemap.xml' },
      check: async (response, body) => {
        const text = new TextDecoder().decode(body)
        const missing = PLATFORM_SLUGS.filter((slug) => !text.includes(`/${slug}`))
        if (missing.length) return `sitemap is missing: ${missing.join(', ')}`
        return null
      },
    },

    {
      name: '404 for unknown path',
      request: { pathname: '/definitely-not-a-real-page' },
      check: async (response) => {
        if (response.status !== 404) return `expected 404, got ${response.status}`
        return null
      },
    },

    // Vulnerability scans are the bulk of a public site's 404s, and rendering
    // Next's not-found page for each was the single most expensive thing the
    // Worker did (up to 116 ms CPU). cloudflare/worker.js answers them before
    // Next loads, which the plain-text body confirms.
    ...['/wp-login.php', '/.env', '/vendor/phpunit.php', '/admin.php'].map((pathname) => ({
      name: `scanner probe ${pathname}`,
      request: { pathname },
      check: async (response, body) => {
        if (response.status !== 404) return `expected 404, got ${response.status}`
        const type = response.headers.get('content-type') ?? ''
        if (!type.includes('text/plain')) {
          return `expected the cheap plain-text 404, got "${type}" (Next rendered it instead)`
        }
        if (new TextDecoder().decode(body) !== 'Not found') return 'unexpected 404 body'
        return null
      },
    })),

    {
      name: 'api/download resolves a YouTube URL',
      // Cobalt has to answer, so allow well over the usual budget.
      request: {
        pathname: '/api/download',
        method: 'POST',
        json: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', quality: '720' },
        timeoutMs: 90_000,
      },
      check: async (response, body) => {
        if (response.status !== 200) return `expected 200, got ${response.status}`
        const payload = JSON.parse(new TextDecoder().decode(body))
        if (!payload.success) return `success=false: ${payload.error ?? 'no error given'}`
        // Shape is flat: { success, downloadUrl, audioUrl, metadata }.
        if (!payload.metadata?.title) return 'no metadata.title in response'
        if (!payload.downloadUrl) return 'no downloadUrl in response'
        // The whole point of preferring cobalt instances that return a tunnel:
        // the browser must be able to pull the bytes itself. If this is empty,
        // every download would instead stream through the Worker — CPU we do
        // not have, and video traffic Cloudflare's free plan does not allow.
        if (!payload.metadata?.directVideoUrl) {
          return 'metadata.directVideoUrl is empty — bytes would proxy through the Worker'
        }
        return null
      },
    },

    {
      name: 'api/download rejects an unsupported URL cleanly',
      request: {
        pathname: '/api/download',
        method: 'POST',
        json: { url: 'https://example.com/not-a-video' },
        timeoutMs: 30_000,
      },
      check: async (response, body) => {
        // The route answers with `{ success: false, error }` and HTTP 500.
        // The 500 is a pre-existing quirk (422 would describe "this post is
        // private or unsupported" far better) and is deliberately not asserted
        // against here — what matters for the Worker is that the failure is a
        // structured JSON response rather than a crash or a CPU overrun.
        const text = new TextDecoder().decode(body)
        let payload
        try {
          payload = JSON.parse(text)
        } catch {
          return `non-JSON error body: ${text.slice(0, 120)}`
        }
        if (payload.success) return 'unsupported URL was accepted'
        if (!payload.error) return 'rejection carried no error message'
        return null
      },
    },

    {
      name: 'api/images maps URLs without buffering',
      request: {
        pathname: '/api/images',
        method: 'POST',
        json: {
          imageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
          title: 'Some Post Title!',
        },
      },
      check: async (response, body) => {
        if (response.status !== 200) return `expected 200, got ${response.status}`
        const payload = JSON.parse(new TextDecoder().decode(body))
        if (!payload.success) return `success=false: ${payload.error ?? ''}`
        const images = payload.images ?? []
        if (images.length !== 2) return `expected 2 images, got ${images.length}`
        if (!images[0].filename?.endsWith('.jpg')) return `bad filename: ${images[0].filename}`
        // Each entry points at the /api/image proxy rather than the origin URL:
        // the browser does the zipping now, and most of these CDNs refuse a
        // cross-origin fetch. Proxying image bytes is fine on CPU (a stream
        // pass-through) — it is *video* that must never transit the Worker.
        const expectedProxy = `/api/image?url=${encodeURIComponent('https://example.com/a.jpg')}`
        if (images[0].url !== expectedProxy) return `expected proxy URL, got ${images[0].url}`
        // Zero-padded index, so a 10+ image carousel sorts correctly on disk.
        if (!/_0*1\.jpg$/.test(images[0].filename)) return `filename is not index-padded: ${images[0].filename}`
        // Title is slugified into the filename so a carousel unzips readably.
        if (!images[0].filename.startsWith('some-post-title')) {
          return `title was not slugified into the filename: ${images[0].filename}`
        }
        return null
      },
    },

    {
      name: 'api/image streams a remote file',
      request: { pathname: `/api/image?url=${encodeURIComponent(PROXY_PROBE_IMAGE)}`, timeoutMs: 30_000 },
      check: async (response, body) => {
        if (response.status !== 200) return `expected 200, got ${response.status}`
        if (body.byteLength < 100) return `streamed only ${body.byteLength} bytes`
        return null
      },
    },

    {
      name: 'api/thumb returns a data URL',
      request: { pathname: `/api/thumb?url=${encodeURIComponent(PROXY_PROBE_IMAGE)}`, timeoutMs: 30_000 },
      check: async (response, body) => {
        if (response.status !== 200) return `expected 200, got ${response.status}`
        const payload = JSON.parse(new TextDecoder().decode(body))
        const dataUrl = payload.dataUrl ?? payload.thumbnail ?? ''
        if (!dataUrl.startsWith('data:image/')) return `no data URL in response: ${JSON.stringify(payload).slice(0, 120)}`
        return null
      },
    },

    {
      name: 'api/image rejects a missing url param',
      request: { pathname: '/api/image' },
      check: async (response) => {
        if (response.status >= 500) return `server error ${response.status}`
        if (response.status === 200) return 'accepted a request with no url'
        return null
      },
    },

    nativeMediaGuard('api/slideshow', {
      pathname: '/api/slideshow',
      method: 'POST',
      json: { images: ['https://example.com/a.jpg'] },
    }),
    nativeMediaGuard('api/tiktok', {
      pathname: '/api/tiktok?url=https%3A%2F%2Fwww.tiktok.com%2F%40a%2Fvideo%2F1',
    }),
    nativeMediaGuard('api/youtube', { pathname: '/api/youtube?id=dQw4w9WgXcQ' }),
  ]

  return checks
}

// --- runner ---------------------------------------------------------------

async function runCheck(check) {
  const { pathname, method = 'GET', json, timeoutMs = 20_000 } = check.request
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()

  try {
    const response = await fetch(`${BASE}${pathname}`, {
      method,
      headers: json ? { 'content-type': 'application/json' } : undefined,
      body: json ? JSON.stringify(json) : undefined,
      signal: controller.signal,
      // Follow the app's own redirects, but surface a redirect loop as a failure
      // rather than hanging.
      redirect: 'follow',
    })
    const body = new Uint8Array(await response.arrayBuffer())
    const elapsed = Date.now() - started

    // A Cloudflare-level error can arrive with any status, so check the body
    // shape before running the route's own assertions.
    const text = body.byteLength < 200 ? new TextDecoder().decode(body) : ''
    const cfCode = cloudflareErrorCode(text)
    if (cfCode) {
      return { ok: false, elapsed, reason: describeCloudflareError(cfCode), fatal: true }
    }

    const reason = await check.check(response, body)
    return { ok: reason === null, elapsed, reason }
  } catch (error) {
    const elapsed = Date.now() - started
    if (error.name === 'AbortError') return { ok: false, elapsed, reason: `timed out after ${timeoutMs} ms` }
    return { ok: false, elapsed, reason: error.message }
  } finally {
    clearTimeout(timer)
  }
}

/** Runs checks with a bounded number in flight, preserving input order. */
async function runAll(checks) {
  const results = new Array(checks.length)
  let next = 0

  async function worker() {
    while (next < checks.length) {
      const index = next++
      results[index] = await runCheck(checks[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, checks.length) }, worker))
  return results
}

async function main() {
  const all = buildChecks()
  const checks = ONLY ? all.filter((c) => c.name.includes(ONLY)) : all
  if (checks.length === 0) {
    throw new Error(`--only ${JSON.stringify(ONLY)} matched none of the ${all.length} checks`)
  }
  console.log(`${C.bold('Target')}  ${BASE}`)
  if (ONLY) console.log(`${C.bold('Filter')}  name contains ${JSON.stringify(ONLY)}`)
  console.log(`${C.bold('Checks')}  ${checks.length} x ${PASSES} pass(es)\n`)

  const failures = []

  for (let pass = 1; pass <= PASSES; pass++) {
    console.log(C.bold(`Pass ${pass}/${PASSES}`))
    const results = await runAll(checks)

    results.forEach((result, index) => {
      const check = checks[index]
      const timing = C.dim(`${String(result.elapsed).padStart(6)} ms`)
      if (result.ok) {
        console.log(`  ${C.green('✓')} ${timing}  ${check.name}`)
        return
      }
      const marker = result.fatal ? C.red('✗✗') : C.red('✗')
      console.log(`  ${marker} ${timing}  ${check.name}\n       ${C.red(result.reason)}`)
      failures.push({ pass, name: check.name, reason: result.reason })
    })
    console.log('')
  }

  if (failures.length === 0) {
    console.log(C.green(`All ${checks.length * PASSES} checks passed across ${PASSES} pass(es).`))
    console.log(C.dim(`(${checks.length} distinct routes exercised; no 1101/1102 seen)`))
    return
  }

  console.log(C.red(`${failures.length} check(s) failed:`))
  for (const failure of failures) {
    console.log(`  ${C.red('·')} pass ${failure.pass}  ${failure.name} — ${failure.reason}`)
  }
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`\n${C.red('✗')} smoke runner crashed: ${error.stack ?? error}`)
  process.exitCode = 1
})
