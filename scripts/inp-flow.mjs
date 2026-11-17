#!/usr/bin/env node
/**
 * `pnpm inp:flow [--runs 3] [--max 150] [--url https://live.site] [--trace]`
 *
 * What the home page's two main taps cost the main thread, on a phone viewport
 * at 4x CPU throttle: the Paste chip (clipboard read allowed, a link on it) and
 * the Download button (a link typed in). Event Timing splits each tap into input
 * delay, processing (handlers plus the render they trigger) and presentation.
 * Field INP on 17 Nov: Paste p75 1016 ms with processing 1011, Download p75 256.
 * This PC rasterises without a GPU, so presentation is not trusted; the gate is
 * on PROCESSING, the part the page's own code decides. Exits 1 when a tap's
 * median processing exceeds --max, printing the number. `--trace` prints the
 * top self-time functions of the first run of each tap from a CPU profile.
 * Needs `pnpm cf:build` unless --url. Limits: one canned resolve, headless.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, launchChrome, wait } from './lib/cdp.mjs'
import { OUT_DIR, serve } from './lib/static-serve.mjs'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}
const RUNS = Number(arg('runs', '3'))
const MAX = Number(arg('max', '150'))
const TRACE = process.argv.includes('--trace')
const SETTLE = Number(arg('settle', '4000'))
const LINK = 'https://x.com/creator/status/1850000000000000000'
const ANSWER = readFileSync(new URL('./fixtures/resolve-proxied.json', import.meta.url))
const VIEWPORT = { width: 390, height: 844, mobile: true }
const RECORDER = `
  window.__events = []
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.interactionId) continue
      window.__events.push({ type: e.name, total: Math.round(e.duration),
        processing: Math.round(e.processingEnd - e.processingStart),
        presentation: Math.round(e.startTime + e.duration - e.processingEnd) })
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true })`

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

async function tap(s, find) {
  const { result } = await s('Runtime.evaluate', {
    expression: `(() => { const b = ${find}; if (!b) return null
      b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`,
    returnByValue: true,
  })
  if (!result.value) throw new Error(`nothing to tap for ${find}`)
  await wait(500)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await s('Input.dispatchMouseEvent', { type, ...result.value, button: 'left', clickCount: 1 })
  }
}

async function startProfile(s) {
  await s('Profiler.enable')
  await s('Profiler.setSamplingInterval', { interval: 200 })
  await s('Profiler.start')
}

/** One fresh phone page; `which` is 'paste' or 'download'. Returns the tap's click timing. */
async function run(cdp, origin, which) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext')
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const s = (method, params) => cdp.send(method, params, sessionId)
  let loaded = null
  const onMsg = async (msg) => {
    if (msg.sessionId !== sessionId) return
    if (msg.method === 'Page.loadEventFired') loaded?.()
    if (msg.method !== 'Fetch.requestPaused') return
    const { requestId, request } = msg.params
    const path = new URL(request.url).pathname
    const answer = (code, body) =>
      s('Fetch.fulfillRequest', {
        requestId,
        responseCode: code,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: Buffer.from(body).toString('base64'),
      }).catch(() => {})
    if (path === '/api/download') {
      await wait(1500)
      return answer(200, ANSWER)
    }
    return answer(path === '/api/auth/refresh' ? 401 : 404, '{"success":false}')
  }
  cdp.on(onMsg)
  try {
    await s('Page.enable')
    await cdp.send('Browser.grantPermissions', {
      origin,
      browserContextId,
      permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
    })
    await s('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1 })
    await s('Emulation.setCPUThrottlingRate', { rate: 4 })
    await s('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] })
    await s('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {${RECORDER}})()` })
    const done = new Promise((r) => (loaded = r))
    await s('Page.navigate', { url: origin + '/' })
    await Promise.race([done, wait(20_000)])
    await wait(SETTLE)
    if (which === 'paste') {
      await s('Runtime.evaluate', {
        expression: `navigator.clipboard.writeText(${JSON.stringify(LINK)})`,
        awaitPromise: true,
        userGesture: true,
      })
      await s('Runtime.evaluate', { expression: 'window.__events = []' })
      if (TRACE) await startProfile(s)
      await tap(s, "[...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-busy') !== null)")
    } else {
      await s('Runtime.evaluate', { expression: "document.querySelector('input[type=url]').focus()" })
      await s('Input.insertText', { text: LINK })
      await wait(500)
      await s('Runtime.evaluate', { expression: 'window.__events = []' })
      if (TRACE) await startProfile(s)
      await tap(s, "document.querySelector('button.btn-grad')")
    }
    await wait(2500)
    let profile = null
    if (TRACE) profile = (await s('Profiler.stop')).profile
    const { result } = await s('Runtime.evaluate', { expression: 'JSON.stringify(window.__events)', returnByValue: true })
    const events = JSON.parse(result.value)
    const click = events.find((e) => e.type === 'click')
    if (!click) throw new Error(`${which}: no click Event Timing entry; saw ${JSON.stringify(events)}`)
    return { click, profile }
  } finally {
    cdp.off(onMsg)
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {})
    await cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {})
  }
}

/** Top self-time functions of a CPU profile. */
function topSelf(profile, n = 14) {
  const byId = new Map(profile.nodes.map((x) => [x.id, x]))
  const self = new Map()
  profile.samples.forEach((id, i) => {
    const dt = profile.timeDeltas[i] / 1000
    const c = byId.get(id).callFrame
    const key = `${c.functionName || '(anon)'} ${c.url.split('/').slice(-2).join('/')}:${c.lineNumber}`
    self.set(key, (self.get(key) ?? 0) + dt)
  })
  return [...self].sort((a, b) => b[1] - a[1]).slice(0, n)
}

if (!arg('url', null) && !existsSync(join(OUT_DIR, 'index.html'))) {
  console.error('inp-flow: out/index.html missing; run `pnpm cf:build` first (or pass --url)')
  process.exit(1)
}
const server = arg('url', null) ? null : await serve()
const origin = arg('url', null) ?? `http://127.0.0.1:${server.address().port}`
const chrome = await launchChrome()
const cdp = await connect(chrome.ws)
let failed = 0
try {
  for (const which of ['paste', 'download']) {
    const rows = []
    for (let i = 0; i < RUNS; i++) {
      const r = await run(cdp, origin, which)
      rows.push(r.click)
      console.log(`  ${which} run ${i + 1}: total ${r.click.total} = processing ${r.click.processing} + presentation ${r.click.presentation}`)
      if (TRACE && r.profile && i === 0) for (const [k, ms] of topSelf(r.profile)) console.log(`      ${ms.toFixed(0)}ms self  ${k}`)
    }
    const proc = median(rows.map((x) => x.processing))
    const pres = median(rows.map((x) => x.presentation))
    const bad = proc > MAX
    if (bad) failed++
    console.log(`${bad ? 'FAIL' : 'ok  '} ${which} tap: median processing ${proc} ms (max ${MAX}), presentation ${pres} ms`)
  }
} finally {
  cdp.close()
  chrome.child.kill()
  server?.close()
}
process.exit(failed ? 1 : 0)
