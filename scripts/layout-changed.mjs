// Decides whether the CI layout-shift check (scripts/cls-audit.mjs, ~2.5 min)
// has anything to check. It runs unless EVERY changed file is one that cannot
// move a pixel on the built page: docs, lessons, tests, tooling scripts, and
// workflows other than the deploy itself. Anything unknown counts as layout, so
// a new kind of file errs toward running the check, never toward skipping it.
//
//   node scripts/layout-changed.mjs <base-sha> [head-sha]
// Writes `run=true|false` to $GITHUB_OUTPUT when set and prints why. No base, or
// a base git can't read (first push, force push), means run.
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [base, head = 'HEAD'] = process.argv.slice(2)
  let decision
  if (!base || /^0+$/.test(base)) {
    decision = { run: true, why: 'no base commit to compare against' }
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
    }
  }
  console.log(`layout check: ${decision.run ? 'RUN' : 'SKIP'} (${decision.why})`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${decision.run}\n`)
}
