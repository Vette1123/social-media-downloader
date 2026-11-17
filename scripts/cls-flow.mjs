#!/usr/bin/env node
/**
 * `pnpm cls:flow [--routes /,/vimeo-downloader] [--delay 1500] [--max 0.1] [--url https://live.site]`
 *
 * The layout shifts a DOWNLOAD causes: type a link, press Enter, the resolve
 * answers `--delay` ms later (scripts/fixtures/resolve-proxied.json, the
 * proxied single-video shape /api/download returns), then tap the result's
 * download button and let /api/video answer `--delay` ms after that, then
 * open the inline preview. The thumbnail is a portrait 9x16 PNG from /api/image,
 * so a preview box that waits for its poster to learn its shape shows up here. cls-audit only measures a refresh;
 * field CLS is what people feel, and on 17 Nov sessions that resolved a link had
 * mobile CLS p75 0.263 against 0.046 for the ones that did not.
 *
 * A shift inside 500 ms of the key press is excused by the browser
 * (hadRecentInput); anything the answer moves later is scored, which is why a
 * resolve that takes seconds can shift the page while the skeleton does not.
 *
 * Throttled like Lighthouse mobile. Exits 1 when a run's total exceeds --max,
 * printing each shift with what grew. Needs `pnpm cf:build` unless --url.
 * Limits: one canned single-video answer; carousels, audio, playback and
 * errors are not driven.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { connect, launchChrome, wait } from './lib/cdp.mjs'
import { shiftRecorderSource } from './lib/cls-observer.mjs'
import { OUT_DIR, serve } from './lib/static-serve.mjs'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const ROUTES = arg('routes', '/,/vimeo-downloader').split(',')
const DELAY_MS = Number(arg('delay', '1500'))
const MAX = Number(arg('max', '0.1'))
const LINK = 'https://x.com/creator/status/1850000000000000000'
const ANSWER = readFileSync(new URL('./fixtures/resolve-proxied.json', import.meta.url))
// INP's parts for every input that took longer than a frame: what the handlers
// cost (processing) and what the frame after them cost (presentation).
const EVENT_RECORDER = `
  window.__events = []
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.interactionId) continue
      window.__events.push({ type: e.name, target: e.target ? e.target.tagName.toLowerCase() + '.' + String(e.target.className).split(' ')[0] : '?',
        total: Math.round(e.duration), input: Math.round(e.processingStart - e.startTime),
        processing: Math.round(e.processingEnd - e.processingStart),
        presentation: Math.round(e.startTime + e.duration - e.processingEnd) })
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true })`

/** A solid w x h PNG, so the thumbnail has a real shape. */
function png(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc(body), body.length + 4)
    return out
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(w, 0)
  header.writeUInt32BE(h, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const rows = Buffer.alloc((w * 3 + 1) * h, 0x40)
  for (let y = 0; y < h; y++) rows[y * (w * 3 + 1)] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const THUMBNAIL = png(90, 160)

const VIEWPORTS = {
  phone: { width: 390, height: 844, mobile: true },
  desktop: { width: 1366, height: 768, mobile: false },
}

/** A real mouse press on the element `find` returns, centred in the viewport first. */
async function tap(s, find, route) {
  const { result } = await s('Runtime.evaluate', {
    expression: `(() => {
      const b = ${find}
      if (!b) return null
      b.scrollIntoView({ block: 'center' })
      const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`,
    returnByValue: true,
  })
  if (!result.value) {
    const seen = await s('Runtime.evaluate', { expression: "location.href + ' | ' + document.title + ' | ' + document.body.innerText.slice(0, 300)", returnByValue: true })
    throw new Error(`${route}: nothing to tap for ${find}; the page read: ${seen.result.value}`)
  }
  await wait(500)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await s('Input.dispatchMouseEvent', { type, ...result.value, button: 'left', clickCount: 1 })
  }
}

async function measure(cdp, origin, route, viewport) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext')
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const s = (method, params) => cdp.send(method, params, sessionId)
  let resolved = 0
  let loaded = null
  let fetched = 0
  const answer = (requestId, code, body, type = 'application/json') =>
    s('Fetch.fulfillRequest', {
      requestId,
      responseCode: code,
      responseHeaders: [{ name: 'content-type', value: type }],
      body: Buffer.from(body).toString('base64'),
    }).catch(() => {})
  const handler = async (msg) => {
    if (msg.sessionId !== sessionId) return
    if (msg.method === 'Page.loadEventFired') loaded?.()
    if (msg.method !== 'Fetch.requestPaused') return
    const { requestId, request } = msg.params
    const path = new URL(request.url).pathname
    if (path === '/api/download') {
      resolved++
      await wait(DELAY_MS)
      return answer(requestId, 200, ANSWER)
    }
    if (path === '/api/image') {
      await wait(DELAY_MS)
      return answer(requestId, 200, THUMBNAIL, 'image/png')
    }
    if (path === '/api/video') {
      fetched++
      await wait(DELAY_MS)
      return answer(requestId, 200, Buffer.alloc(256 * 1024), 'video/mp4')
    }
    return answer(requestId, path === '/api/auth/refresh' ? 401 : 404, '{"success":false}')
  }
  cdp.on(handler)
  try {
    await s('Page.enable')
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny', browserContextId })
    await s('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1 })
    await s('Network.enable')
    await s('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    await s('Emulation.setCPUThrottlingRate', { rate: 4 })
    await s('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] })
    await s('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {${shiftRecorderSource()}${EVENT_RECORDER}})()` })
    const done = new Promise((r) => (loaded = r))
    await s('Page.navigate', { url: origin + route })
    await Promise.race([done, wait(20_000)])
    await wait(4000)
    // Load shifts are cls-audit's job; this run scores the flow only.
    await s('Runtime.evaluate', { expression: "document.querySelector('input[type=url]').focus(); window.__shifts = []" })
    await s('Input.insertText', { text: LINK })
    for (const type of ['keyDown', 'keyUp']) {
      await s('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    }
    await wait(DELAY_MS + 3000)
    await tap(s, "document.querySelector('button.btn-grad')", route)
    await wait(DELAY_MS + 8000)
    await tap(s, `[...document.querySelectorAll('button.btn-ghost')].find((b) => /preview/i.test(b.textContent))`, route)
    await wait(DELAY_MS + 3000)
    const { result } = await s('Runtime.evaluate', {
      expression: 'JSON.stringify({ shifts: window.__shifts, events: window.__events })',
      returnByValue: true,
    })
    if (!resolved) throw new Error(`${route}: Enter sent no /api/download request`)
    if (!fetched) throw new Error(`${route}: the download button fetched no /api/video`)
    const { shifts, events } = JSON.parse(result.value)
    // Prove the run: the answer rendered, and a 300px insert at the top registers.
    const check = await s('Runtime.evaluate', {
      expression: `(async () => {
        const card = [...document.querySelectorAll('h3')].find((h) => h.textContent.includes('resolved through the proxy'))
        const scrolled = Math.round(window.scrollY)
        window.scrollTo(0, 0)
        await new Promise((r) => setTimeout(r, 300))
        const before = window.__shifts.length
        const block = document.createElement('div')
        block.style.height = '300px'
        document.body.prepend(block)
        await new Promise((r) => setTimeout(r, 800))
        block.remove()
        return { card: card ? Math.round(card.getBoundingClientRect().y) : null, seen: window.__shifts.length - before, scrolled }
      })()`,
      awaitPromise: true,
      returnByValue: true,
    })
    const { card, seen, scrolled } = check.result.value
    if (card === null) throw new Error(`${route}: the resolved card never rendered`)
    if (!(seen > 0)) throw new Error(`${route}: detector saw no shift from a 300px insert`)
    return { cls: shifts.reduce((a, x) => a + x.value, 0), shifts, card, scrolled, events }
  } finally {
    cdp.off(handler)
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {})
    await cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {})
  }
}

const liveUrl = arg('url', null)
if (!liveUrl && !existsSync(join(OUT_DIR, 'index.html'))) {
  console.error('cls-flow: out/index.html missing; run `pnpm cf:build` first (or pass --url)')
  process.exit(1)
}
const server = liveUrl ? null : await serve()
const origin = liveUrl ?? `http://127.0.0.1:${server.address().port}`
const chrome = await launchChrome()
const cdp = await connect(chrome.ws)
let failed = 0
try {
  for (const route of ROUTES) {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      const r = await measure(cdp, origin, route, viewport)
      const bad = r.cls > MAX
      if (bad) failed++
      console.log(`${bad ? 'FAIL' : 'ok  '} ${r.cls.toFixed(4)}  ${route} ${name}  (${r.shifts.length} shifts, card at y=${r.card}, scrollY ${r.scrolled})`)
      for (const e of r.events) console.log(`    input ${e.type} on ${e.target}: ${e.total}ms = delay ${e.input} + handlers ${e.processing} + frame ${e.presentation}`)
      for (const shift of r.shifts) {
        console.log(`    ${shift.value.toFixed(4)} at ${shift.at}ms`)
        for (const g of shift.grew) console.log(`      grew  ${g}`)
        for (const src of shift.sources.slice(0, 3)) console.log(`      moved ${src.node}  y ${src.from[0]}->${src.to[0]}`)
      }
    }
  }
} finally {
  cdp.close()
  chrome.child.kill()
  server?.close()
}
console.log(failed ? `cls-flow: ${failed} run(s) over ${MAX}` : `cls-flow: every run at or under ${MAX}`)
process.exit(failed ? 1 : 0)
