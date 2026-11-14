#!/usr/bin/env node
/**
 * `pnpm cls [--routes /,/ar] [--max 0.001] [--url https://live.site]`
 *
 * Every layout shift a REFRESH causes, per visitor kind, with the element that
 * moved. Lighthouse only ever sees a first-time anonymous visitor; the shifts
 * people report come from state that visitor never has: a supporter, a
 * returning visitor with a Recent list.
 *
 * Headless Chrome over the DevTools protocol, no dependencies:
 *   - each scenario runs in a fresh browser context, seeded before the first
 *     byte (cookie + localStorage), so the page boots exactly as it would for
 *     that person;
 *   - `/api/auth/refresh` is answered as the server would answer that person
 *     (a supporter gets `pro: true`); every other `/api/*` call gets an empty 404,
 *     and the script lists them;
 *   - the page is loaded, then reloaded, and the reload is measured;
 *   - two viewports: a phone, and the same phone 6000 px tall, so a shift
 *     anywhere down the page counts, not only in the first screen.
 *
 * Throttled like Lighthouse mobile (150 ms RTT, 1.6 Mbps, 4x CPU), so the HTML
 * paints before the JS lands, as on a phone.
 *
 * Exits 1 when any run's shift total exceeds --max. Needs `pnpm cf:build`
 * first, unless --url points at a deployed site. Limit: Chrome only; a shift
 * that needs a slower phone than the throttle above can still hide.
 */
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { connect, launchChrome, wait } from './lib/cdp.mjs'
import { OUT_DIR, serve } from './lib/static-serve.mjs'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const ROUTES = arg('routes', '/,/tiktok-downloader,/ar,/pro').split(',')
const MAX = Number(arg('max', '0.001'))
const SETTLE_MS = Number(arg('settle', '5000'))

const now = Date.now()
const HISTORY = Array.from({ length: 6 }, (_, i) => ({
  url: `https://www.tiktok.com/@creator.name_${i}/video/73${i}0000000000000000`,
  title: i === 1 ? 'A much longer title that wraps onto a second line on a phone screen, as real ones do' : `Clip ${i}`,
  author: 'creator.name',
  platform: 'tiktok',
  ts: now - i * 3_600_000,
}))

const SCENARIOS = {
  free: { cookie: null, storage: {}, pro: false },
  returning: { cookie: null, storage: { 'smd:history:v1': HISTORY }, pro: false },
  pro: {
    cookie: 'smd_account=1',
    storage: {
      smd_profile: { email: 'supporter@example.com', name: 'Supporter', picture: null, pro: true },
      'smd:history:v1': HISTORY,
    },
    pro: true,
  },
}
const VIEWPORTS = {
  phone: { width: 390, height: 844, mobile: true },
  'phone-full': { width: 390, height: 6000, mobile: true },
}

function refreshBody(pro) {
  return {
    success: true,
    token: 'audit-token',
    expiresAt: Date.now() + 15 * 60_000,
    userId: 'audit-user',
    pro,
    email: 'supporter@example.com',
    name: 'Supporter',
    picture: null,
    plan: pro ? 'monthly' : null,
    prefs: null,
  }
}

// Runs in the page before any of its own scripts, on every document.
function bootSource({ cookie, storage }) {
  return `(() => {
    try {
      ${cookie ? `document.cookie = ${JSON.stringify(cookie + '; path=/')};` : ''}
      const seed = ${JSON.stringify(storage)};
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
    } catch {}
    const label = (node) => {
      if (!node || node.nodeType !== 1) return node ? '#text' : '?'
      const cls = (node.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 3).join('.')
      const text = (node.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50)
      return node.tagName.toLowerCase() + (cls ? '.' + cls : '') + (text ? ' "' + text + '"' : '')
    }
    // A shift names what moved, not what pushed it. Heights are snapshotted at
    // DOMContentLoaded and again after each shift; the deepest elements whose
    // height changed since are the likely cause.
    let heights = new Map()
    const snapshot = () => {
      const m = new Map()
      for (const el of document.querySelectorAll('body *')) m.set(el, el.getBoundingClientRect().height)
      return m
    }
    const growers = () => {
      const now = snapshot()
      const changed = new Map()
      for (const [el, h] of now) {
        const delta = Math.round(h - (heights.get(el) ?? 0))
        if (Math.abs(delta) >= 40) changed.set(el, delta)
      }
      heights = now
      const deepest = [...changed].filter(([el, delta]) =>
        ![...el.children].some((c) => changed.has(c) && Math.abs(changed.get(c) - delta) < 8))
      return deepest
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 4)
        .map(([el, delta]) => (delta > 0 ? '+' : '') + delta + 'px ' + label(el) + (heights.has(el) ? '' : ' (new)'))
    }
    document.addEventListener('DOMContentLoaded', () => { heights = snapshot() })
    window.__shifts = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue
        window.__shifts.push({
          value: e.value,
          at: Math.round(e.startTime),
          grew: growers(),
          sources: (e.sources || []).map((s) => ({
            node: label(s.node),
            from: [s.previousRect.y, s.previousRect.height].map(Math.round),
            to: [s.currentRect.y, s.currentRect.height].map(Math.round),
          })),
        })
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })()`
}


async function measure(cdp, origin, route, scenario, viewport) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext')
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const s = (method, params) => cdp.send(method, params, sessionId)
  const apiCalls = new Set()
  let loaded = null
  const handler = async (msg) => {
    if (msg.sessionId !== sessionId) return
    if (msg.method === 'Page.loadEventFired') loaded?.()
    if (msg.method !== 'Fetch.requestPaused') return
    const { requestId, request } = msg.params
    const path = new URL(request.url).pathname
    const isRefresh = path === '/api/auth/refresh'
    if (!isRefresh) apiCalls.add(path)
    const body = isRefresh && scenario.cookie ? refreshBody(scenario.pro) : { success: false }
    await s('Fetch.fulfillRequest', {
      requestId,
      responseCode: isRefresh && scenario.cookie ? 200 : isRefresh ? 401 : 404,
      responseHeaders: [{ name: 'content-type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify(body)).toString('base64'),
    }).catch(() => {})
  }
  cdp.on(handler)
  try {
    await s('Page.enable')
    await s('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
    })
    // A phone, not this machine: without it the JS lands before first paint and
    // every shift happens off screen. Lighthouse's mobile numbers.
    await s('Network.enable')
    await s('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    await s('Emulation.setCPUThrottlingRate', { rate: 4 })
    await s('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] })
    await s('Page.addScriptToEvaluateOnNewDocument', { source: bootSource(scenario) })
    const load = async (fn) => {
      const done = new Promise((r) => (loaded = r))
      await fn()
      await Promise.race([done, wait(20_000)])
      await wait(SETTLE_MS)
    }
    await load(() => s('Page.navigate', { url: origin + route }))
    await load(() => s('Page.reload', { ignoreCache: false }))
    const { result } = await s('Runtime.evaluate', {
      expression:
        "JSON.stringify({ shifts: window.__shifts || [], pro: document.documentElement.hasAttribute('data-pro'), " +
        "reserved: document.documentElement.hasAttribute('data-recent') ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--recent-h')) : 0, " +
        "list: Math.round(document.querySelector('[data-recent-list]')?.getBoundingClientRect().height ?? 0) })",
      returnByValue: true,
    })
    const { shifts, pro, reserved, list } = JSON.parse(result.value)
    // The detector proves itself on every run: a block pushed in at the top must
    // register, or a 0 above means "could not see", not "did not move".
    const probe = await s('Runtime.evaluate', {
      expression: `(async () => {
        const before = window.__shifts.length
        const block = document.createElement('div')
        block.style.height = '300px'
        document.body.prepend(block)
        await new Promise((r) => setTimeout(r, 800))
        block.remove()
        return window.__shifts.length - before
      })()`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (!(probe.result.value > 0)) throw new Error(`detector saw no shift from a 300px insert on ${route}`)
    return { cls: shifts.reduce((a, x) => a + x.value, 0), shifts, pro, reserved, list, apiCalls: [...apiCalls] }
  } finally {
    cdp.off(handler)
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {})
    await cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {})
  }
}

// --- run ---------------------------------------------------------------------

const liveUrl = arg('url', null)
if (!liveUrl && !existsSync(join(OUT_DIR, 'index.html'))) {
  console.error('cls-audit: out/index.html missing; run `pnpm cf:build` first (or pass --url)')
  process.exit(1)
}
const server = liveUrl ? null : await serve()
const origin = liveUrl ?? `http://127.0.0.1:${server.address().port}`
const chrome = await launchChrome()
const cdp = await connect(chrome.ws)

const failures = []
const unanswered = new Set()
let runs = 0
try {
  for (const route of ROUTES) {
    for (const [scenarioName, scenario] of Object.entries(SCENARIOS)) {
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        const r = await measure(cdp, origin, route, scenario, viewport)
        runs++
        r.apiCalls.forEach((p) => unanswered.add(p))
        // A supporter run that did not boot as one would pass for the wrong reason.
        if (r.pro !== scenario.pro) failures.push(`${route} ${scenarioName}: page booted as ${r.pro ? 'pro' : 'free'}`)
        const tag = `${route} ${scenarioName} ${viewportName}`
        // Recent is not in the static HTML. Before paint, the head script must
        // reserve exactly the height the list renders at (src/lib/recentReserve.ts);
        // a fast machine hydrates before painting and would hide a missing reserve.
        if (scenario.storage['smd:history:v1'] && (r.list === 0 || Math.abs(r.reserved - r.list) > 1)) {
          failures.push(`${tag}: Recent reserved ${r.reserved}px before paint, rendered ${r.list}px`)
          console.log(`FAIL Recent reserve ${r.reserved}px vs list ${r.list}px  ${tag}`)
        }
        const verdict = r.cls > MAX ? 'FAIL' : 'ok  '
        console.log(`${verdict} ${r.cls.toFixed(4)}  ${tag}`)
        if (r.cls > MAX) {
          failures.push(tag)
          for (const shift of r.shifts) {
            console.log(`       +${shift.value.toFixed(4)} at ${shift.at} ms`)
            for (const g of shift.grew) console.log(`         grew ${g}`)
            for (const src of shift.sources) {
              console.log(`         ${src.node}  y/h ${src.from.join('/')} -> ${src.to.join('/')}`)
            }
          }
        }
      }
    }
  }
} finally {
  cdp.close()
  chrome.child.kill()
  server?.close()
  await wait(300)
  rmSync(chrome.profile, { recursive: true, force: true, maxRetries: 3 })
}

if (unanswered.size) console.log(`cls-audit: /api calls answered 404 (not part of this audit): ${[...unanswered].join(', ')}`)
if (failures.length) {
  console.error(`cls-audit: ${failures.length}/${runs} runs failed (layout shift over ${MAX}, or a Recent reserve that does not match the list)`)
  process.exit(1)
}
console.log(`cls-audit: ${runs}/${runs} runs within ${MAX} (${ROUTES.length} routes x ${Object.keys(SCENARIOS).length} visitors x ${Object.keys(VIEWPORTS).length} viewports, measured on reload)`)
