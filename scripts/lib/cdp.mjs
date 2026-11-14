/**
 * A minimal DevTools-protocol client over headless Chrome, no dependencies.
 * Shared by `pnpm cls` and `pnpm shots`.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const CHROME =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((p) => existsSync(p))

// --- a minimal DevTools-protocol client --------------------------------------

export function launchChrome() {
  if (!CHROME) throw new Error('no Chrome found; set CHROME_PATH')
  const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
  const child = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
  ])
  return new Promise((resolve, reject) => {
    let err = ''
    child.stderr.on('data', (d) => {
      err += d
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/)
      if (m) resolve({ child, profile, ws: m[1] })
    })
    child.on('exit', (code) => reject(new Error(`Chrome exited ${code}: ${err.slice(-300)}`)))
  })
}

export function connect(url) {
  const ws = new WebSocket(url)
  let id = 0
  const pending = new Map()
  const handlers = new Set()
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    } else if (msg.method) {
      for (const h of handlers) h(msg)
    }
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const msgId = ++id
      pending.set(msgId, { resolve, reject })
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }))
    })
  return new Promise((resolve) => {
    ws.onopen = () => resolve({ send, on: (h) => handlers.add(h), off: (h) => handlers.delete(h), close: () => ws.close() })
  })
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms))
