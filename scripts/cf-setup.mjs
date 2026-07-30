/**
 * One-command Cloudflare setup: everything the deploy needs that isn't already
 * in wrangler.jsonc or the GitHub workflow.
 *
 *   node scripts/cf-setup.mjs check     verify the token, resolve the account,
 *                                       report zone + Worker status
 *   node scripts/cf-setup.mjs deploy    build the Worker bundle and upload it
 *   node scripts/cf-setup.mjs secrets   push Worker secrets from .env.cloudflare
 *   node scripts/cf-setup.mjs zone      add the domain to Cloudflare, print the
 *                                       nameservers to set at the registrar
 *   node scripts/cf-setup.mjs domain    attach apex + www to the Worker
 *   node scripts/cf-setup.mjs all       every step above, in order, skipping
 *                                       whatever is already done
 *
 * Credentials come from `.env.cloudflare` (gitignored — see
 * .env.cloudflare.sample). Nothing here reads or writes wrangler.jsonc, which
 * is committed and must stay free of secrets.
 *
 * The REST API is used directly rather than `wrangler secret put` etc. because
 * those prompt on a TTY and behave differently under CI; plain fetch calls are
 * the same everywhere and give usable errors.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = path.join(ROOT, '.env.cloudflare')
const API = 'https://api.cloudflare.com/client/v4'

// Keys that authenticate the tooling. Everything else in .env.cloudflare is a
// Worker secret and gets uploaded.
const CREDENTIAL_KEYS = new Set(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'])

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.socialdownloader.space'
).replace(/\/+$/, '')
// e.g. www.socialdownloader.space -> apex socialdownloader.space. The zone is
// always registered at the apex; both hostnames get attached to the Worker so
// a visitor typing the bare domain doesn't hit a dead name after the DNS move.
const WWW_HOSTNAME = new URL(SITE_URL).host
const APEX = WWW_HOSTNAME.replace(/^www\./, '')

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

const ok = (msg) => console.log(`${C.green('✓')} ${msg}`)
const info = (msg) => console.log(`${C.dim('·')} ${C.dim(msg)}`)
const warn = (msg) => console.log(`${C.yellow('!')} ${msg}`)
const step = (msg) => console.log(`\n${C.bold(msg)}`)

class SetupError extends Error {}

/** Minimal dotenv parser — avoids a dependency for ~15 lines of work. */
function readEnvFile(file) {
  if (!existsSync(file)) return null
  const out = {}
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // Strip one matching pair of surrounding quotes, if present.
    if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

/** The Worker name, read from the committed wrangler.jsonc (which has comments). */
function workerName() {
  const source = readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8')
  const match = source.match(/^\s*"name":\s*"([^"]+)"/m)
  if (!match) throw new SetupError('Could not read "name" from wrangler.jsonc')
  return match[1]
}

/**
 * Calls the Cloudflare API and unwraps the standard envelope.
 * `allowFailure` returns the raw envelope instead of throwing, for the cases
 * where a 404/"already exists" is a normal outcome rather than an error.
 */
async function cf(token, endpoint, { method = 'GET', body, allowFailure = false } = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new SetupError(`${method} ${endpoint} returned non-JSON (HTTP ${response.status})`)
  }

  if (allowFailure) return payload
  if (!payload.success) {
    const detail = (payload.errors ?? [])
      .map((e) => `[${e.code}] ${e.message}`)
      .join('; ')
    throw new SetupError(`${method} ${endpoint} failed: ${detail || `HTTP ${response.status}`}`)
  }
  return payload.result
}

/** Runs a local command, streaming its output, and fails the script on error. */
function run(command, args, env) {
  info(`$ ${command} ${args.join(' ')}`)
  // shell:true because pnpm/wrangler are .cmd shims on Windows, which
  // spawnSync cannot execute directly.
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) {
    throw new SetupError(`\`${command} ${args.join(' ')}\` exited with code ${result.status}`)
  }
}

// --- steps ----------------------------------------------------------------

async function resolveContext() {
  const env = readEnvFile(ENV_FILE)
  if (!env) {
    throw new SetupError(
      `Missing ${path.relative(ROOT, ENV_FILE)}.\n` +
        '  Copy .env.cloudflare.sample to .env.cloudflare and paste your API token into it.',
    )
  }

  const token = env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN
  if (!token) {
    throw new SetupError(
      'CLOUDFLARE_API_TOKEN is empty in .env.cloudflare.\n' +
        '  Create one at https://dash.cloudflare.com/profile/api-tokens\n' +
        '  (see .env.cloudflare.sample for the exact permissions needed).',
    )
  }

  const verify = await cf(token, '/user/tokens/verify', { allowFailure: true })
  if (!verify.success) {
    const detail = (verify.errors ?? []).map((e) => e.message).join('; ')
    throw new SetupError(`API token rejected by Cloudflare: ${detail || 'unknown reason'}`)
  }
  ok(`API token valid (status: ${verify.result.status})`)

  let accountId = env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) {
    const accounts = await cf(token, '/accounts?per_page=50')
    if (accounts.length === 0) {
      throw new SetupError('Token has no account access. Re-create it with Account Resources set.')
    }
    if (accounts.length > 1) {
      const names = accounts.map((a) => `${a.name} (${a.id})`).join('\n    ')
      throw new SetupError(
        `Token can see ${accounts.length} accounts. Set CLOUDFLARE_ACCOUNT_ID in .env.cloudflare to one of:\n    ${names}`,
      )
    }
    accountId = accounts[0].id
    ok(`Account: ${accounts[0].name} (${accountId})`)
  } else {
    ok(`Account: ${accountId} (from .env.cloudflare)`)
  }

  return { env, token, accountId, script: workerName() }
}

/** Looks up the zone without creating it. Returns null when absent. */
async function findZone(token, accountId) {
  const zones = await cf(token, `/zones?name=${encodeURIComponent(APEX)}&account.id=${accountId}`)
  return zones[0] ?? null
}

async function stepCheck(ctx) {
  step('Status')

  const zone = await findZone(ctx.token, ctx.accountId)
  if (!zone) {
    warn(`Zone ${APEX} is not on this Cloudflare account yet — run the \`zone\` step.`)
  } else if (zone.status === 'active') {
    ok(`Zone ${APEX} is active`)
  } else {
    warn(`Zone ${APEX} exists but is "${zone.status}" — nameservers not switched yet.`)
    info(`Set these at your registrar: ${(zone.name_servers ?? []).join(', ')}`)
  }

  const worker = await cf(
    ctx.token,
    `/accounts/${ctx.accountId}/workers/scripts/${ctx.script}`,
    { allowFailure: true },
  )
  const deployed = worker.success !== false
  if (deployed) ok(`Worker "${ctx.script}" is deployed`)
  else warn(`Worker "${ctx.script}" not deployed yet — run the \`deploy\` step.`)

  return { zone, deployed }
}

async function stepDeploy(ctx) {
  step('Deploy')
  const env = {
    CLOUDFLARE_API_TOKEN: ctx.token,
    CLOUDFLARE_ACCOUNT_ID: ctx.accountId,
    // NEXT_PUBLIC_* is inlined by the bundler, so it has to be present for the
    // build rather than supplied as a Worker var at runtime.
    NEXT_PUBLIC_SITE_URL: SITE_URL,
    YOUTUBE_DL_SKIP_PYTHON_CHECK: '1',
  }
  run('pnpm', ['cf:build'], env)
  run('pnpm', ['exec', 'opennextjs-cloudflare', 'deploy'], env)
  ok('Worker deployed')
}

async function stepSecrets(ctx) {
  step('Secrets')

  const entries = Object.entries(ctx.env).filter(
    ([key, value]) => !CREDENTIAL_KEYS.has(key) && value !== '',
  )
  if (entries.length === 0) {
    info('No Worker secrets set in .env.cloudflare — skipping.')
    info('The site runs without them; cobalt falls back to the public instance.')
    return
  }

  for (const [name, text] of entries) {
    await cf(ctx.token, `/accounts/${ctx.accountId}/workers/scripts/${ctx.script}/secrets`, {
      method: 'PUT',
      body: { name, text, type: 'secret_text' },
    })
    // Never echo the value — this output can end up in a shared terminal log.
    ok(`${name} uploaded (${text.length} chars)`)
  }
}

async function stepZone(ctx) {
  step('Zone')

  const existing = await findZone(ctx.token, ctx.accountId)
  const zone =
    existing ??
    (await cf(ctx.token, '/zones', {
      method: 'POST',
      body: { name: APEX, account: { id: ctx.accountId }, type: 'full' },
    }))

  if (existing) ok(`Zone ${APEX} already on the account (status: ${zone.status})`)
  else ok(`Zone ${APEX} created`)

  if (zone.status === 'active') {
    ok('Nameservers already point at Cloudflare')
    return zone
  }

  console.log(
    `\n${C.bold('ACTION REQUIRED')} — at your registrar (the domain is on Namecheap:\n` +
      '  Domain List -> Manage -> Nameservers -> Custom DNS), replace both\n' +
      '  dns1/dns2.registrar-servers.com entries with:\n',
  )
  for (const ns of zone.name_servers ?? []) console.log(`      ${C.bold(ns)}`)
  console.log(
    `\n  Propagation is usually minutes, up to 24h. Cloudflare emails you when the\n` +
      `  zone goes active. Then run: ${C.bold('node scripts/cf-setup.mjs domain')}\n`,
  )
  return zone
}

async function stepDomain(ctx) {
  step('Custom domains')

  const zone = await findZone(ctx.token, ctx.accountId)
  if (!zone) {
    throw new SetupError(`Zone ${APEX} is not on this account. Run the \`zone\` step first.`)
  }
  if (zone.status !== 'active') {
    warn(`Zone ${APEX} is "${zone.status}" — Cloudflare can only attach a Worker to an active zone.`)
    info(`Waiting on the nameserver switch at the registrar: ${(zone.name_servers ?? []).join(', ')}`)
    return
  }

  // Both hostnames point at the same Worker. The app emits a canonical link to
  // the www form, so the apex serving the same content is not a duplicate
  // content problem, and it keeps the bare domain alive after the DNS move.
  for (const hostname of [APEX, WWW_HOSTNAME]) {
    await cf(ctx.token, `/accounts/${ctx.accountId}/workers/domains`, {
      method: 'PUT',
      body: {
        environment: 'production',
        hostname,
        service: ctx.script,
        zone_id: zone.id,
      },
    })
    ok(`${hostname} -> Worker "${ctx.script}"`)
  }

  console.log(
    `\n  Cloudflare manages the DNS records for these automatically — no manual\n` +
      '  A/CNAME needed, and the old Vercel CNAME is superseded.\n',
  )
}

// --- entry point ----------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'check'
  const ctx = await resolveContext()

  if (command === 'check') {
    await stepCheck(ctx)
    return
  }
  if (command === 'deploy') {
    await stepDeploy(ctx)
    return
  }
  if (command === 'secrets') {
    await stepSecrets(ctx)
    return
  }
  if (command === 'zone') {
    await stepZone(ctx)
    return
  }
  if (command === 'domain') {
    await stepDomain(ctx)
    return
  }
  if (command === 'all') {
    const status = await stepCheck(ctx)
    // Deploy before secrets: the secrets endpoint targets a script that has to
    // exist. Redeploying later does not clear them.
    if (!status.deployed) await stepDeploy(ctx)
    else info('Worker already deployed — skipping build. Use `deploy` to force one.')
    await stepSecrets(ctx)
    const zone = await stepZone(ctx)
    if (zone.status === 'active') await stepDomain(ctx)
    return
  }

  throw new SetupError(
    `Unknown command "${command}". Expected one of: check, deploy, secrets, zone, domain, all`,
  )
}

main().catch((error) => {
  const message = error instanceof SetupError ? error.message : (error.stack ?? String(error))
  console.error(`\n${C.red('✗')} ${message}\n`)
  process.exitCode = 1
})
