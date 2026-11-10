#!/usr/bin/env node
/**
 * `pnpm perf:idle [--url http://localhost:3000/] [--seconds 5] [--max-paints 2]
 *                 [--hover | --move] [--css "..."]`
 *
 * What a page costs the GPU while nobody is doing anything. Headless Chrome at a
 * 1440x900 desktop viewport (fine pointer, hover: the path that gets every
 * effect) loads the page, settles 3s, traces --seconds, and counts paints and
 * frames per second. A page at rest should paint ~0/s; one infinite paint
 * animation shows up as hundreds of Paint events a second.
 *
 *   (default)  pointer outside the page. FAILS on any infinite animation
 *              running, or paints/s over --max-paints.
 *   --hover    pointer parked on the first .glow-card (the hero, where people
 *              paste and wait). The ring may run here, but on the compositor:
 *              FAILS on paints/s over --max-paints.
 *   --move     pointer circling the viewport. Reports only: hover effects are
 *              supposed to paint while the pointer moves.
 *   --css      inject a stylesheet first, to switch one layer off and see what
 *              it costs, e.g. --css ".bg-grid-hot{display:none}".
 *
 * Refuses to measure a page that did not render (no <h1>), and the Cloudflare
 * challenge production serves to headless Chrome: run it against `pnpm dev` or
 * a local export. Limits: headless rasterises in software, so this counts work,
 * it does not time a GPU; desktop path only (touch and .low-power devices get
 * cheaper CSS); a dev server's first seconds after start add frames, so warm it
 * with one request first. PROBE_DEBUG=1 prints the busiest trace events.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const URL_ = arg('url', 'http://localhost:3000/')
const SECONDS = Number(arg('seconds', '5'))
const MAX_PAINTS = Number(arg('max-paints', '2'))
const MOVE = process.argv.includes('--move')
const HOVER = process.argv.includes('--hover')
const CSS = arg('css', '')
const MODE = (MOVE && 'mouse moving') || (HOVER && 'pointer resting on .glow-card') || 'at rest'
const PORT = 9300 + Math.floor(Math.random() * 500)
const CHROME = process.env.CHROME_BIN ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'idle-probe-'))}`,
    '--window-size=1440,900',
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore' }
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function pageSocket() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(200)
  }
  throw new Error(`Chrome did not expose a page on port ${PORT} within 10s`)
}

const ws = new WebSocket(await pageSocket())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let nextId = 0
const pending = new Map()
const listeners = new Map()
ws.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  } else if (msg.method) listeners.get(msg.method)?.(msg.params)
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { returnByValue: true, expression })).result.value
const mouse = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(x), y: Math.round(y) })

const INFINITE_RUNNING = `document.getAnimations()
  .filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity)
  .map(a => (a.animationName ?? a.constructor.name) + ' on ' + (a.effect.target?.className?.toString?.().slice(0, 40) ?? '?') + (a.effect.pseudoElement ?? ''))`

try {
  await send('Page.enable')
  const loaded = new Promise((r) => listeners.set('Page.loadEventFired', r))
  await send('Page.navigate', { url: URL_ })
  await loaded
  await sleep(3000)
  if (CSS)
    await evaluate(
      `document.head.append(Object.assign(document.createElement('style'), { textContent: ${JSON.stringify(CSS)} }))`
    )

  const env = await evaluate(`({
    title: document.title,
    h1: document.querySelector('h1')?.textContent.trim().slice(0, 60) ?? null,
    hover: matchMedia('(hover: hover)').matches,
    fine: matchMedia('(pointer: fine)').matches,
    lowPower: document.documentElement.classList.contains('low-power'),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  })`)
  // A page that did not render paints nothing and would pass: refuse it.
  if (/just a moment/i.test(env.title))
    throw new Error('Cloudflare challenge page, not the site: measure a local build (--url http://localhost:...)')
  if (!env.h1) throw new Error(`No <h1> on ${URL_} (title "${env.title}"): the page did not render, nothing to measure`)

  if (HOVER) {
    const card = await evaluate(
      `(() => { const c = document.querySelector('.glow-card'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.max(r.y, 0) + 12 } })()`
    )
    if (!card) throw new Error(`--hover: no .glow-card on ${URL_}`)
    await mouse(card.x, card.y)
    await sleep(1000) // past the 0.4s fade-in
  }
  const running = await evaluate(INFINITE_RUNNING)

  const events = []
  listeners.set('Tracing.dataCollected', (p) => events.push(...p.value))
  const done = new Promise((r) => listeners.set('Tracing.tracingComplete', r))
  await send('Tracing.start', {
    categories: 'devtools.timeline,disabled-by-default-devtools.timeline.frame',
    transferMode: 'ReportEvents',
  })
  if (MOVE) {
    const end = Date.now() + SECONDS * 1000
    for (let t = 0; Date.now() < end; t++) {
      await mouse(720 + 400 * Math.cos(t / 20), 450 + 250 * Math.sin(t / 20))
      await sleep(16)
    }
  } else await sleep(SECONDS * 1000)
  await send('Tracing.end')
  await done

  // Trace events come as complete (X) or begin/end (B/E) pairs: count one per event.
  const count = (name) => events.filter((e) => e.name === name && e.ph !== 'E').length
  const perSec = (n) => (n / SECONDS).toFixed(1)
  const paints = count('Paint')
  if (process.env.PROBE_DEBUG) {
    const tally = {}
    for (const e of events) if (e.ph !== 'E') tally[e.name] = (tally[e.name] ?? 0) + 1
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 12)
    console.log('top events:', top.map(([k, v]) => `${k}=${v}`).join(' '))
  }
  console.log(`page: "${env.title}" / h1 "${env.h1}"  (${URL_})`)
  console.log(
    `path: hover=${env.hover} fine-pointer=${env.fine} low-power=${env.lowPower} reduced-motion=${env.reducedMotion}${CSS ? ` css=${CSS}` : ''}`
  )
  console.log(`infinite animations running (${running.length}): ${running.join(' | ') || 'none'}`)
  console.log(
    `${MODE}, ${SECONDS}s: Paint ${perSec(paints)}/s, frames drawn ${perSec(count('DrawFrame'))}/s`
  )

  const loops = !MOVE && !HOVER && running.length > 0
  if (MOVE) console.log('--move: report only, no budget')
  else if (loops || paints / SECONDS > MAX_PAINTS) {
    console.error(
      `FAIL (${MODE}): ${loops ? `${running.length} infinite animation(s), ` : ''}${perSec(paints)} paints/s, budget ${MAX_PAINTS}/s`
    )
    process.exitCode = 1
  } else console.log(`OK (${MODE}): ${perSec(paints)} paints/s within ${MAX_PAINTS}/s`)
} finally {
  ws.close()
  chrome.kill()
}
