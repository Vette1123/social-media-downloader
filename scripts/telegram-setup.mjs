#!/usr/bin/env node
/**
 * Wires the Telegram bot to the site: `pnpm telegram:setup`.
 *
 * Copy the bot token in BotFather (tap it, or /mybots → API Token), then run
 * this. It reads the token from the clipboard so it never lands in a file or
 * the shell history, checks it with getMe, uploads TELEGRAM_BOT_TOKEN and a
 * fresh TELEGRAM_WEBHOOK_SECRET as Worker secrets, registers the webhook and the
 * bot's profile text, asserts getWebhookInfo, and clears the clipboard.
 *
 * Re-run after BotFather /revoke. Limits: Windows or macOS clipboard only; the
 * secret upload creates a new Worker version with the code already deployed.
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import process from 'node:process'

const SITE = 'https://www.socialdownloader.space'
const WEBHOOK = `${SITE}/api/telegram`
const TOKEN_SHAPE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/

const DESCRIPTION =
  'Send a link from TikTok, Instagram, YouTube, X, Facebook, Reddit, Pinterest, Threads or any video page and get the file back. Free, no sign-up. Public posts only.'
const SHORT_DESCRIPTION = 'Send a video link, get the file. Free, no sign-up. socialdownloader.space'
const COMMANDS = [
  { command: 'start', description: 'How to use the bot' },
  { command: 'help', description: 'Which links work' },
]

function fail(message) {
  console.error(`telegram:setup: ${message}`)
  process.exit(1)
}

function readClipboard() {
  const cmd =
    process.platform === 'win32'
      ? ['powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw']]
      : ['pbpaste', []]
  const out = spawnSync(cmd[0], cmd[1], { encoding: 'utf8' })
  return (out.stdout ?? '').trim()
}

function clearClipboard() {
  if (process.platform === 'win32')
    spawnSync('powershell', ['-NoProfile', '-Command', 'Set-Clipboard -Value $null'])
  else spawnSync('sh', ['-c', 'printf "" | pbcopy'])
}

async function api(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!json.ok) fail(`${method} failed: ${res.status} ${json.description ?? ''}`)
  return json.result
}

function putSecret(name, value) {
  const run = spawnSync(`pnpm exec wrangler secret put ${name}`, {
    input: value,
    shell: true,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  if (run.status !== 0) fail(`wrangler secret put ${name} exited ${run.status}`)
}

const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || readClipboard()
if (!TOKEN_SHAPE.test(token))
  fail(`no bot token on the clipboard (read ${token.length} chars). Copy it in BotFather first.`)

const me = await api(token, 'getMe')
console.log(`token ok: @${me.username} (id ${me.id})`)

const secret = randomBytes(24).toString('hex')
putSecret('TELEGRAM_BOT_TOKEN', token)
putSecret('TELEGRAM_WEBHOOK_SECRET', secret)
console.log('secrets uploaded: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET')

await api(token, 'setWebhook', {
  url: WEBHOOK,
  secret_token: secret,
  allowed_updates: ['message'],
  drop_pending_updates: true,
})
await api(token, 'setMyCommands', { commands: COMMANDS })
await api(token, 'setMyDescription', { description: DESCRIPTION })
await api(token, 'setMyShortDescription', { short_description: SHORT_DESCRIPTION })

const info = await api(token, 'getWebhookInfo')
if (info.url !== WEBHOOK) fail(`webhook is ${info.url || 'unset'}, expected ${WEBHOOK}`)
console.log(`webhook ok: ${info.url}, pending ${info.pending_update_count}, last error: ${info.last_error_message ?? 'none'}`)

if (!process.env.TELEGRAM_BOT_TOKEN) clearClipboard()
console.log(`done: https://t.me/${me.username}`)
