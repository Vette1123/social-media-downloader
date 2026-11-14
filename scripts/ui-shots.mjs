#!/usr/bin/env node
/**
 * `pnpm shots [--url https://live.site] [--routes /,/ar] [--out dir] [--phone-width 320]`
 *
 * Phone and desktop screenshots of each route, first screen and full page, plus
 * the one layout check a screenshot can hide: nothing may be wider than the
 * viewport. A phone that can scroll sideways is a broken page even when every
 * card looks fine in the first screen.
 *
 * Exits 1 naming each element that overflows, with how far. Serves the static
 * export (`pnpm cf:build` first), as `pnpm cls` does: the live site answers
 * headless Chrome with a Cloudflare challenge, and the script refuses to grade
 * that page. Limits: Chrome only; layout after interaction (a result card, an
 * error) is not covered.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { connect, launchChrome, wait } from './lib/cdp.mjs'
import { OUT_DIR, serve } from './lib/static-serve.mjs'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const LIVE = arg('url', null)
const ROUTES = arg('routes', '/,/ar,/tiktok-downloader,/pro').split(',')
const OUT = resolve(arg('out', '.ui-shots'))
const VIEWPORTS = [
  // --phone-width 320 is the narrowest phone still sold (iPhone SE 1st gen).
  { name: 'phone', width: Number(arg('phone-width', 390)), height: 844, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]

// Runs in the page: every element whose right edge passes the viewport, outermost first.
const OVERFLOW = `(() => {
  const vw = document.documentElement.clientWidth
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.right <= vw + 1) continue
    let p = el.parentElement, clipped = false
    while (p && p !== document.body) {
      const o = getComputedStyle(p).overflowX
      if (o !== 'visible') { clipped = true; break }
      p = p.parentElement
    }
    if (clipped) continue
    const cls = (el.getAttribute('class') || '').split(/\\s+/).slice(0, 3).join('.')
    out.push(el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' +' + Math.round(r.right - vw) + 'px')
  }
  return JSON.stringify({ scroll: document.documentElement.scrollWidth - vw, items: out.slice(0, 8) })
})()`

if (!LIVE && !existsSync(join(OUT_DIR, 'index.html'))) {
  console.error('shots: out/index.html missing; run `pnpm cf:build` first (or pass --url)')
  process.exit(1)
}
const server = LIVE ? null : await serve()
const ORIGIN = (LIVE ?? `http://127.0.0.1:${server.address().port}`).replace(/\/$/, '')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const chrome = await launchChrome()
const cdp = await connect(chrome.ws)
const failures = []
try {
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const { browserContextId } = await cdp.send('Target.createBrowserContext')
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId })
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
      const s = (method, params) => cdp.send(method, params, sessionId)
      await s('Page.enable')
      await s('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile,
      })
      if (vp.mobile) await s('Emulation.setTouchEmulationEnabled', { enabled: true })
      await s('Page.navigate', { url: ORIGIN + route })
      await wait(6000)
      const slug = `${route.replace(/\W+/g, '_') || '_'}-${vp.name}`
      const shot = async (file, full) => {
        const { data } = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full })
        writeFileSync(join(OUT, file), Buffer.from(data, 'base64'))
      }
      await shot(`${slug}.png`, false)
      await shot(`${slug}-full.png`, true)
      // The full page shrinks to unreadable once a model or a chat scales it,
      // so the page is also cut into screens of the viewport's own height. Each
      // one is SCROLLED to, not clipped from beyond the viewport: sections with
      // content-visibility:auto (.defer-render) are never painted off screen,
      // and a clip captured them as black.
      const { result: tall } = await s('Runtime.evaluate', {
        expression: 'document.documentElement.scrollHeight',
      })
      const screens = Math.min(Math.ceil(tall.value / vp.height), 12)
      for (let i = 1; i < screens; i++) {
        await s('Runtime.evaluate', { expression: `window.scrollTo(0, ${i * vp.height})` })
        await wait(500)
        await shot(`${slug}-s${i}.png`, false)
      }
      await s('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' })
      const { result: title } = await s('Runtime.evaluate', { expression: 'document.title' })
      if (/just a moment|security verification/i.test(title.value)) {
        throw new Error(`${route}: got a bot challenge, not the page; serve the build instead of --url`)
      }
      const { result } = await s('Runtime.evaluate', { expression: OVERFLOW })
      const { scroll, items } = JSON.parse(result.value)
      const verdict = scroll > 0 ? `OVERFLOW ${scroll}px` : 'fits'
      console.log(`${route.padEnd(22)} ${vp.name.padEnd(8)} ${verdict}`)
      if (scroll > 0) {
        failures.push(`${route} ${vp.name}`)
        for (const item of items) console.log(`    ${item}`)
      }
      await cdp.send('Target.disposeBrowserContext', { browserContextId })
    }
  }
} finally {
  cdp.close()
  chrome.child.kill()
  server?.close()
  await wait(300)
  // Windows can still hold the profile a moment after the kill; a stale temp
  // folder is not worth failing the run over.
  try {
    rmSync(chrome.profile, { recursive: true, force: true, maxRetries: 3 })
  } catch {
    console.warn(`shots: left ${chrome.profile} behind (still locked)`)
  }
}
console.log(`shots: ${OUT}`)
if (failures.length) {
  console.error(`::error::${failures.length} view(s) scroll sideways: ${failures.join(', ')}`)
  process.exit(1)
}
