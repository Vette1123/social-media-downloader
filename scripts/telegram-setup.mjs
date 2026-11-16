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
 * `pnpm telegram:setup --check` only reports the webhook's delivery health.
 * `pnpm telegram:setup --profile` only republishes the public profile (name,
 * About, description, commands in every site language, plus the avatar
 * rendered from src/lib/brandMark.ts), so copy or icon edits ship without
 * rotating the secrets.
 * Re-run after BotFather /revoke. Limits: Windows or macOS clipboard only; the
 * secret upload creates a new Worker version with the code already deployed.
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import process from 'node:process'
import sharp from 'sharp'
import { brandMarkSvg } from '../src/lib/brandMark.ts'
import { BOT_COPY } from '../src/lib/telegramCopy.ts'

const SITE = 'https://www.socialdownloader.space'
const WEBHOOK = `${SITE}/api/telegram`
const TOKEN_SHAPE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/


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

// `--check`: report delivery health only, change nothing.
if (process.argv.includes('--check')) {
  const info = await api(token, 'getWebhookInfo')
  const lastError = info.last_error_date
    ? `${new Date(info.last_error_date * 1000).toISOString()} ${info.last_error_message}`
    : 'none'
  console.log(`webhook: ${info.url || 'unset'}, pending ${info.pending_update_count}, last error: ${lastError}`)
  if (!process.env.TELEGRAM_BOT_TOKEN) clearClipboard()
  process.exit(info.url === WEBHOOK && !info.last_error_date ? 0 : 1)
}

/** Telegram serves each profile field per user language; '' is the default. */
async function publishProfile() {
  for (const [locale, copy] of Object.entries(BOT_COPY)) {
    const language_code = locale === 'en' ? '' : locale
    await api(token, 'setMyName', { name: copy.name, language_code })
    await api(token, 'setMyShortDescription', { short_description: copy.shortDescription, language_code })
    await api(token, 'setMyDescription', { description: copy.description, language_code })
    await api(token, 'setMyCommands', {
      commands: [
        { command: 'start', description: copy.commands.start },
        { command: 'help', description: copy.commands.help },
      ],
      language_code,
    })
    console.log(`profile ok: ${locale || 'default'} "${copy.name}"`)
  }
  await publishAvatar()
}

/** The app mark as the bot's avatar, rendered here from brandMark.ts (the
 * full-bleed maskable variant suits Telegram's circle crop), so it never waits
 * on a deploy. Older Bot API servers lack the method: then say so and leave the
 * avatar to BotFather /setuserpic. */
async function publishAvatar() {
  const buffer = await sharp(Buffer.from(brandMarkSvg({ maskable: true })), { density: 90 })
    .resize(640, 640)
    .png()
    .toBuffer()
  const png = new Blob([buffer], { type: 'image/png' })
  const form = new FormData()
  form.append('photo', JSON.stringify({ type: 'static', photo: 'attach://avatar' }))
  form.append('avatar', png, 'avatar.png')
  const res = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, { method: 'POST', body: form })
  const json = await res.json().catch(() => ({}))
  if (json.ok) console.log(`avatar ok: ${png.size} bytes, 640px from src/lib/brandMark.ts`)
  else console.log(`avatar NOT set (${res.status} ${json.description ?? ''}): use BotFather /setuserpic`)
}

if (process.argv.includes('--profile')) {
  await publishProfile()
  if (!process.env.TELEGRAM_BOT_TOKEN) clearClipboard()
  process.exit(0)
}

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
await publishProfile()

const info = await api(token, 'getWebhookInfo')
if (info.url !== WEBHOOK) fail(`webhook is ${info.url || 'unset'}, expected ${WEBHOOK}`)
console.log(`webhook ok: ${info.url}, pending ${info.pending_update_count}, last error: ${info.last_error_message ?? 'none'}`)

if (!process.env.TELEGRAM_BOT_TOKEN) clearClipboard()
console.log(`done: https://t.me/${me.username}`)
