// pnpm posthog:watch [--dry] [--days 3]
//
// Reads PostHog for the problems a person would otherwise find by hand in
// `posthog:usage` (a supported host routed to `generic`, one link shape failing
// for several people, a platform failing a third of the time, an error kind
// spreading, downloads going silent) and files one GitHub issue per problem.
// The rules and thresholds live in scripts/lib/posthog-watch-rules.mjs.
//
// Runs daily from .github/workflows/posthog-watch.yml. Locally it uses
// `gh auth token`; in Actions, GITHUB_TOKEN.
import { execFileSync } from 'node:child_process'
import process from 'node:process'

import { posthogConfig, runQuery } from './lib/posthog.mjs'
import { EXPECTED_CODES, decideAction, findProblems, issueBody, issueKey } from './lib/posthog-watch-rules.mjs'

const LABEL = 'posthog-watch'
const args = process.argv.slice(2)
const dry = args.includes('--dry')
const days = Number(args[args.indexOf('--days') + 1]) || 3
if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error(`--days must be 1-14, got ${days}`)

const windowStart = new Date(Date.now() - days * 86_400_000)
const since = `timestamp > now() - INTERVAL ${days} DAY`
const ourFault = `event = 'resolve_failed' AND toString(properties.code) NOT IN (${EXPECTED_CODES.map((c) => `'${c}'`).join(', ')})`

const QUERIES = {
  shapes: `SELECT toString(properties.platform) AS platform, toString(properties.code) AS code,
                  toString(properties.host) AS host, toString(properties.shape) AS shape,
                  count() AS n, uniq(person_id) AS people
           FROM events WHERE {humans} AND ${since} AND event = 'resolve_failed'
           GROUP BY platform, code, host, shape HAVING people >= 2
           ORDER BY people DESC LIMIT 200`,
  platforms: `SELECT toString(properties.platform) AS platform,
                     if(toString(properties.format) = 'audio', 'audio', 'video') AS format,
                     countIf(event = 'resolve_succeeded') AS ok, countIf(${ourFault}) AS bad,
                     uniqIf(person_id, ${ourFault}) AS bad_people
              FROM events WHERE {humans} AND ${since} AND event IN ('resolve_succeeded', 'resolve_failed')
              GROUP BY platform, format ORDER BY bad DESC LIMIT 100`,
  errors: `SELECT any(event) AS ev,
                  coalesce(nullIf(toString(properties.source), ''), toString(properties.$exception_types)) AS kind,
                  count() AS n, uniq(person_id) AS people
           FROM events WHERE {humans} AND ${since} AND event IN ('$exception', 'api_error')
             -- expected = a network drop, reported for trends, not a bug
             AND ifNull(toString(properties.expected), '') != 'true'
           GROUP BY kind HAVING people >= 2 ORDER BY people DESC LIMIT 50`,
  completed: `SELECT count() AS n FROM events
              WHERE {humans} AND timestamp > now() - INTERVAL 1 DAY AND event = 'download_completed'`,
}

function github() {
  const token = process.env.GITHUB_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()
  const repo =
    process.env.GITHUB_REPOSITORY ||
    execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8' }).trim()
  return async (method, path, body) => {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'posthog-watch',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok && !(method === 'POST' && path === '/labels' && res.status === 422)) {
      throw new Error(`GitHub ${method} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }
    return res.status === 204 ? null : res.json()
  }
}

async function existingIssues(gh) {
  const byKey = new Map()
  for (let page = 1; page <= 10; page += 1) {
    const batch = await gh('GET', `/issues?labels=${LABEL}&state=all&per_page=100&page=${page}`)
    for (const issue of batch) {
      const key = issueKey(issue.body)
      // Newest first: the first issue seen for a key is the one that counts.
      if (key && !byKey.has(key)) byKey.set(key, issue)
    }
    if (batch.length < 100) break
  }
  return byKey
}

const cfg = posthogConfig()
const [shapes, platforms, errors, completed] = await Promise.all(
  Object.values(QUERIES).map((sql) => runQuery(cfg, sql)),
)
const completed24h = Number(completed[0]?.n ?? 0)
const problems = findProblems({ shapes, platforms, errors, completed24h }, days)

console.log(`posthog:watch — last ${days} days: ${shapes.length} failing shapes, ${platforms.length} platforms, ${errors.length} error kinds, ${completed24h} downloads in 24 h`)
console.log(`${problems.length} problem(s) over the thresholds${dry ? ' (dry run, nothing filed)' : ''}`)

if (dry) {
  for (const p of problems) console.log(`  [${p.kind}] ${p.title}`)
  process.exit(0)
}

const gh = github()
await gh('POST', '/labels', { name: LABEL, color: 'f9a825', description: 'Filed by pnpm posthog:watch from PostHog data' })
const issues = await existingIssues(gh)
const runUrl = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : undefined
const tally = { create: 0, update: 0, reopen: 0, skip: 0 }

for (const p of problems) {
  const issue = issues.get(p.key)
  const action = decideAction(issue, windowStart)
  tally[action] += 1
  const body = issueBody(p, { window: `last ${days} days to ${new Date().toISOString().slice(0, 10)}`, runUrl })
  if (action === 'create') {
    const made = await gh('POST', '/issues', { title: p.title, body, labels: [LABEL, 'bug'] })
    console.log(`  created #${made.number} ${p.title}`)
  } else if (action === 'update') {
    await gh('PATCH', `/issues/${issue.number}`, { title: p.title, body })
    console.log(`  updated #${issue.number} ${p.title}`)
  } else if (action === 'reopen') {
    await gh('PATCH', `/issues/${issue.number}`, { state: 'open', title: p.title, body })
    await gh('POST', `/issues/${issue.number}/comments`, { body: `Recurred after the close: ${p.detail}` })
    console.log(`  reopened #${issue.number} ${p.title}`)
  } else {
    console.log(`  skipped #${issue.number} (${issue.state_reason || issue.state}) ${p.title}`)
  }
}

console.log(`created ${tally.create}, updated ${tally.update}, reopened ${tally.reopen}, skipped ${tally.skip}`)
