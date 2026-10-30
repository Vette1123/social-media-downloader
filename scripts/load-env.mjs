import { setDefaultResultOrder } from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Node 17+ hands back whatever the resolver returns, AAAA first. On a machine
// with an IPv6 address but no working IPv6 route — a home ISP, most corporate
// wifi — every `fetch` hangs for the full connect timeout and then reports
// `fetch failed`, which reads exactly like a bad token or an outage.
setDefaultResultOrder('ipv4first')

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Load `.env.local` if it exists. CI puts the config on the environment
 * already; locally it lives there.
 */
export function loadLocalEnv() {
  try {
    process.loadEnvFile(path.join(root, '.env.local'))
  } catch {
    // No .env.local (CI) — the environment already carries everything.
  }
}
