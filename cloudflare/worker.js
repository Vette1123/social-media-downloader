/**
 * Cloudflare Worker entrypoint.
 *
 * Wraps the worker that `opennextjs-cloudflare build` generates, and handles a
 * few paths *before* delegating to it. The point is the free plan's 10 ms CPU
 * budget: Next's server initializes lazily, and whichever request triggers that
 * initialization is billed for it — measured at 76-98 ms. It is not a
 * once-per-deploy cost either, because every new isolate pays it again, so
 * roughly a third of requests to any Next-served route were running 8-10x over
 * budget. Cloudflare tolerates bursts, then returns `error code 1102`.
 *
 * Anything handled here never touches Next and stays in single-digit ms.
 *
 * Deliberately plain JavaScript, not TypeScript: tsconfig.json includes
 * `**\/*.ts` with only node_modules excluded, so a .ts entrypoint importing the
 * generated `.open-next/worker.js` would fail `tsc --noEmit` on a fresh
 * checkout, where that file does not exist yet.
 *
 * Note that static assets are matched before the Worker is invoked at all, so
 * pages, icons and the prerendered OpenGraph images never reach this code.
 */

import { API_ROUTES } from '../src/lib/apiRoutes'

/**
 * The generated worker is imported lazily, on the first request that actually
 * needs Next to render something.
 *
 * A static `import` would put the whole Next server in this module's graph, and
 * a cold isolate then evaluates it before running any handler — measurably so:
 * with a static import, /api/download still spiked to 114 ms on a fresh isolate
 * despite never calling into Next, while warm requests cost ~0 ms. Deferring it
 * keeps API requests from paying for a framework they do not use.
 */
let openNextWorkerPromise = null

function loadOpenNextWorker() {
  openNextWorkerPromise ??= import('../.open-next/worker.js').then((m) => m.default)
  return openNextWorkerPromise
}

/**
 * Paths that are unmistakably vulnerability scans rather than real navigation.
 *
 * A public site collects a constant drizzle of these, and each one was booting
 * Next to render a 404 — the single most expensive thing the Worker did (up to
 * 116 ms). None of the app's real routes end in these extensions, and requests
 * for genuine static files are answered from assets before reaching the Worker,
 * so short-circuiting here cannot shadow anything that exists.
 *
 * Ordinary typo 404s still fall through to Next and render the real not-found
 * page; they are rare enough not to matter, and worth a proper page.
 */
const SCANNER_PATH = /\.(php|phtml|asp|aspx|jsp|cgi|env|sql|bak|old|ini|conf|sh|py|rb|pl|war|jar)$/i
const SCANNER_PREFIX = /^\/(wp-|wordpress|vendor\/|\.git|\.env|cgi-bin|phpmyadmin|admin\.php)/i

function isScannerProbe(pathname) {
  return SCANNER_PATH.test(pathname) || SCANNER_PREFIX.test(pathname)
}

/** HEAD is served by the GET handler, as it is for any ordinary route. */
function methodMatches(requestMethod, routeMethod) {
  if (requestMethod === routeMethod) return true
  return routeMethod === 'GET' && requestMethod === 'HEAD'
}

const worker = {
  /**
   * @param {Request} request
   * @param {Record<string, unknown>} env
   * @param {{ waitUntil: (p: Promise<unknown>) => void }} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // Every /api/* route, dispatched without touching Next. These are the same
    // functions the App Router route files call, so this path and local `next
    // dev` cannot drift. A method mismatch deliberately falls through, letting
    // Next produce its usual 405.
    const route = API_ROUTES[url.pathname]
    if (route && methodMatches(request.method, route.method)) {
      return route.handler(request)
    }

    if (isScannerProbe(url.pathname)) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          // Nothing here will ever exist; let intermediaries stop asking.
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    const openNextWorker = await loadOpenNextWorker()
    return openNextWorker.fetch(request, env, ctx)
  },
}

export default worker

// The generated worker also exports Durable Object classes (DOQueueHandler,
// DOShardedTagCache, BucketCachePurge). They are deliberately NOT re-exported
// here: a static re-export would pull the Next bundle into this module's graph
// and defeat the lazy import above. wrangler.jsonc declares no durable_objects
// bindings — the queue and tag cache belong to OpenNext's ISR machinery, which
// this app does not use, since every route is prerendered and none revalidate.
// Adding such a binding later means re-exporting them from a separate entry.
