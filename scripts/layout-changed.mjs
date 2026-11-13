// Decides whether the CI layout-shift check (scripts/cls-audit.mjs, ~2.5 min)
// has anything to check. It runs unless EVERY file changed since the last
// commit the check actually PASSED on is one that cannot move a pixel: docs,
// lessons, tests, tooling scripts, and workflows other than the deploy itself.
// Unknown files count as layout, so a new kind of file errs toward running.
//
// The baseline is read from this workflow's own run history, not from the
// push's `before`: a push run that was cancelled, superseded by a scheduled
// run, or failed never checked anything, and diffing from `before` would let
// its changes through unchecked (it did, on 2026-11-13).
//
//   node scripts/layout-changed.mjs [fallback-base] [head]
// Writes `run=true|false` to $GITHUB_OUTPUT when set and prints why. No
// baseline it can trust means run.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const INERT = [
  /\.md$/i,
  /^lessons\//,
  /^docs\//,
  /\.test\.(ts|tsx|mjs|js)$/,
  /^\.claude\//,
  /^LICENSE$/,
  // Tooling, except the audit itself (changing the check must run the check) and
  // the two that shape what ships: build-output rewriting and response headers.
  /^scripts\/(?!(cls-audit|cf-postbuild|headerRules)\.mjs$)[^/]+$/,
  // Other workflows; the deploy workflow decides how the site is built.
  /^\.github\/(?!workflows\/deploy-cloudflare\.yml$)/,
]

export function touchesLayout(files) {
  return files.filter((f) => !INERT.some((re) => re.test(f)))
}

export const CHECK_STEP = 'Layout shift check (build)'

/** Newest run (API order) whose layout step really ran and passed; its commit. */
export function lastCheckedSha(runs) {
  for (const run of runs) {
    const step = run.jobs.flatMap((j) => j.steps ?? []).find((s) => s.name === CHECK_STEP)
    if (step?.conclusion === 'success') return run.head_sha
  }
  return null
}

async function baselineFromHistory() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env
  if (!token || !repo) return null
  const gh = async (path) => {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status} on ${path}`)
    return res.json()
  }
  const { workflow_runs: runs } = await gh(
    '/actions/workflows/deploy-cloudflare.yml/runs?branch=main&status=success&per_page=15',
  )
  const withJobs = []
  for (const run of runs) {
    const { jobs } = await gh(`/actions/runs/${run.id}/jobs`)
    withJobs.push({ head_sha: run.head_sha, jobs })
    const sha = lastCheckedSha(withJobs)
    if (sha) return sha
  }
  return null
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [fallback, head = 'HEAD'] = process.argv.slice(2)
  let base = null
  let source = ''
  try {
    base = await baselineFromHistory()
    if (base) source = `last commit the check passed on, ${base.slice(0, 7)}`
  } catch (error) {
    console.log(`run history unreadable (${error.message})`)
  }
  if (!base && fallback && !process.env.GITHUB_ACTIONS) {
    base = fallback
    source = `given base ${fallback.slice(0, 7)}`
  }
  let decision
  if (!base) {
    decision = { run: true, why: 'no commit the check is known to have passed on' }
  } else {
    let files = null
    try {
      files = execFileSync('git', ['diff', '--name-only', base, head], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
    } catch {
      decision = { run: true, why: `git cannot diff ${base}..${head}` }
    }
    if (files) {
      const layout = touchesLayout(files)
      decision = layout.length
        ? { run: true, why: `${layout.length} of ${files.length} changed files can affect layout: ${layout.slice(0, 5).join(', ')}` }
        : { run: false, why: `all ${files.length} changed files are docs, tests or tooling` }
      decision.why += ` (since ${source})`
    }
  }
  console.log(`layout check: ${decision.run ? 'RUN' : 'SKIP'} (${decision.why})`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${decision.run}\n`)
}
