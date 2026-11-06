#!/usr/bin/env node
// Hand a supporter the extras, or take them back.
//
//   pnpm pro someone@example.com            # grant
//   pnpm pro someone@example.com --revoke   # take it back
//
// Support is arranged by email (src/config/support.ts), so this is the only way
// `pro` is granted. It writes two places, in this order:
//
//   supporters  the durable record, keyed by the address. An account created
//               later claims it on sign-in (src/lib/billing/supporters.ts), so
//               granting to an address with no account yet is normal.
//   users       the column the app reads, refreshed for every row holding that
//               address. Read-modify-write, never `grants='pro'`: the column is
//               a set that `ig` also lives in, and an assignment drops it.
//
// Revoking keeps the supporters row as a tombstone (grants = '').
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()
try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'))
} catch {
  // CI and some machines keep everything in .env.local or the environment.
}

const args = process.argv.slice(2)
const revoke = args.includes('--revoke')
const email = args
  .find((a) => !a.startsWith('-'))
  ?.trim()
  .toLowerCase()

const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim()
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
// wrangler.jsonc → d1_databases[0].database_id
const DATABASE_ID = 'a8831143-b1d2-43a6-916b-e1ac27349fb1'
const GRANT = 'pro'

function fail(message) {
  console.error(`\n✘ ${message}`)
  process.exit(1)
}

if (!email) fail('usage: pnpm pro <email> [--revoke]')
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`not an email: ${email}`)
if (!TOKEN) fail('CLOUDFLARE_API_TOKEN is not set (.env / .env.local)')
if (!ACCOUNT_ID) fail('CLOUDFLARE_ACCOUNT_ID is not set (.env / .env.local)')

async function d1(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    },
  )
  const json = await res.json()
  if (!json.success) fail(`D1 query failed (HTTP ${res.status}): ${JSON.stringify(json.errors)}`)
  return json.result?.[0]?.results ?? []
}

/** The stored set, trimmed and de-duplicated. Mirrors src/lib/billing/entitlement.ts. */
const parse = (current) => [
  ...new Set(
    (current ?? '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean),
  ),
]

const withGrant = (current) => {
  const names = parse(current)
  if (!names.includes(GRANT)) names.push(GRANT)
  return names.join(',')
}

const withoutGrant = (current) => {
  const names = parse(current).filter((n) => n !== GRANT)
  return names.length > 0 ? names.join(',') : null
}

const now = Date.now()

if (revoke) {
  await d1(
    `UPDATE supporters SET grants = '', lifetime = 0, source = 'manual', updated_at = ? WHERE email = ?`,
    [now, email],
  )
} else {
  await d1(
    `INSERT INTO supporters (email, grants, level, lifetime, source, event_id, updated_at)
     VALUES (?, ?, 'manual', 1, 'manual', NULL, ?)
     ON CONFLICT(email) DO UPDATE SET
       grants = excluded.grants,
       level = excluded.level,
       lifetime = MAX(supporters.lifetime, excluded.lifetime),
       source = excluded.source,
       updated_at = excluded.updated_at`,
    [email, GRANT, now],
  )
}

// Every row with that address: email is not unique (a deleted and recreated
// Google account can leave two).
const users = await d1('SELECT id, grants FROM users WHERE email = ?', [email])
for (const user of users) {
  const next = revoke ? withoutGrant(user.grants) : withGrant(user.grants)
  if (next === user.grants) continue
  await d1('UPDATE users SET grants = ? WHERE id = ?', [next, user.id])
}

console.log(`\n✔ ${GRANT} ${revoke ? 'revoked' : 'granted'} for ${email}`)
if (users.length === 0) {
  console.log(
    revoke
      ? '  No account holds that address — the supporters row is tombstoned, so a later sign-in claims nothing.'
      : '  No account holds that address yet — it is claimed on their first sign-in.',
  )
} else {
  for (const user of users) console.log(`  account ${user.id}`)
}
