// Real screens of the live site, for the films. Headless Chrome over the DevTools
// protocol (Node's own WebSocket, the Chrome already on this machine), so the films show
// the product as it ships and nothing has to be mocked up to look like it.
//
//   pnpm capture            -> public/shots/<name>.png, every shot below
//   pnpm capture result     -> only the shots whose name contains "result"
//
// A shot that does not reach its `ready` condition in time fails the run with its name:
// a film built on a half-loaded page is worse than no film.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'shots')
const SITE = 'https://www.socialdownloader.space'
// A public post on Telegram's own channel: an official clip, safe to show.
const DEMO_LINK = 'https://t.me/durov/566'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const paste = (link) => `(() => {
  const input = document.getElementById('${'paste-url'}') || document.querySelector('input[type=url]')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(input, ${JSON.stringify(link)})
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  return true
})()`

const hasResult = `!!document.querySelector('video, [data-result], a[download], button[aria-label*="ownload"]') && !document.querySelector('[aria-busy="true"]')`

const SHOTS = [
  { name: 'home-desktop', url: SITE + '/', w: 1440, h: 900, dpr: 2 },
  { name: 'home-mobile', url: SITE + '/', w: 390, h: 844, dpr: 3, mobile: true },
  { name: 'result-desktop', url: SITE + '/', w: 1440, h: 900, dpr: 2, act: paste(DEMO_LINK), ready: hasResult, settle: 2500 },
]

const CHROME = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p))
if (!CHROME) throw new Error('No Chrome found; set CHROME to its path.')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PORT = 9300 + Math.floor(Math.random() * 400)

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id
      pending.set(n, { resolve, reject })
      ws.send(JSON.stringify({ id: n, method, params }))
    })
  return { send, close: () => ws.close() }
}

async function evaluate(page, expression) {
  const r = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  return r.result?.value
}

async function waitFor(page, expression, ms, what) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await evaluate(page, expression).catch(() => false)) return
    await sleep(250)
  }
  throw new Error(`${what}: not ready after ${ms}ms (${expression.slice(0, 80)})`)
}

async function shoot(page, shot) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: shot.w,
    height: shot.h,
    deviceScaleFactor: shot.dpr,
    mobile: !!shot.mobile,
  })
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: !!shot.mobile })
  await page.send('Network.setUserAgentOverride', { userAgent: shot.mobile ? UA_MOBILE : UA })
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
  await page.send('Page.navigate', { url: shot.url })
  await waitFor(page, `document.readyState === 'complete'`, 30000, shot.name)
  await sleep(1500)
  if (shot.act) await evaluate(page, shot.act)
  if (shot.ready) await waitFor(page, shot.ready, 45000, shot.name)
  if (shot.scroll) await evaluate(page, `window.scrollTo(0, document.body.scrollHeight * ${shot.scroll})`)
  await sleep(shot.settle ?? 1200)
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(join(OUT, `${shot.name}.png`), Buffer.from(data, 'base64'))
  console.log(`shot ${shot.name}  ${shot.w}x${shot.h}@${shot.dpr}`)
}

const only = process.argv[2]
const todo = SHOTS.filter((s) => !only || s.name.includes(only))
if (todo.length === 0) throw new Error(`No shot matches "${only}".`)
mkdirSync(OUT, { recursive: true })

const profile = mkdtempSync(join(tmpdir(), 'capture-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--hide-scrollbars',
  '--no-first-run',
  '--mute-audio',
  'about:blank',
])
let failed = 0
try {
  let version
  for (let i = 0; i < 60 && !version; i++) {
    version = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => null)
    if (!version) await sleep(250)
  }
  const target = version?.find((t) => t.type === 'page')
  if (!target) throw new Error('Chrome started without a page target.')
  const page = await cdp(target.webSocketDebuggerUrl)
  await page.send('Page.enable')
  await page.send('Runtime.enable')
  for (const shot of todo) {
    try {
      await shoot(page, shot)
    } catch (e) {
      failed++
      console.error(`FAIL ${shot.name}: ${e.message}`)
    }
  }
  page.close()
} finally {
  chrome.kill()
}
console.log(`${todo.length - failed}/${todo.length} shots`)
process.exit(failed ? 1 : 0)
