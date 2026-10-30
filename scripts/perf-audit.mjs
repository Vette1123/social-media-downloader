#!/usr/bin/env node
/**
 * `pnpm perf [--url https://live.site] [--routes /,/pro] [--runs 3] [--min 95]`
 *
 * Lighthouse on mobile and desktop against the static export, served the way
 * production serves it: Brotli, immutable hashed assets. `next start` cannot
 * stand in — the build is `output: 'export'`, and an uncompressed local server
 * would report a transfer size no visitor ever gets.
 *
 * Reports the median of --runs per route and form factor, and exits 1 when a
 * category drops under --min or the mobile LCP/CLS/TBT budgets are missed.
 *
 * Limits: simulated throttling on this machine, so a number is comparable with
 * another run here, not with field data. Run `pnpm cf:build` first; it does not
 * rebuild. Lighthouse comes from `pnpm dlx`, so it is not a dependency; point
 * LIGHTHOUSE_BIN at a local install to skip re-resolving it on every run.
 */

import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'

const OUT_DIR = 'out'
const DEFAULT_ROUTES = ['/', '/tiktok-downloader', '/pro']
const LIGHTHOUSE_TIMEOUT_MS = 180_000
const BUDGET = { lcpMs: 2000, tbtMs: 150, cls: 0.01 }
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml'])

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function resolveFile(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^[\\/]+/, '')
  return [clean, join(clean, 'index.html'), `${clean}.html`]
    .map((candidate) => join(OUT_DIR, candidate))
    .find((file) => existsSync(file) && statSync(file).isFile())
}

function serve() {
  const compressed = new Map()
  const server = createServer((req, res) => {
    const file = resolveFile(new URL(req.url, 'http://x').pathname)
    if (!file) {
      res.writeHead(404, { 'content-type': MIME['.html'] })
      res.end(readFileSync(join(OUT_DIR, '404.html')))
      return
    }
    const ext = extname(file)
    const headers = { 'content-type': MIME[ext] ?? 'application/octet-stream' }
    if (file.includes('_next')) headers['cache-control'] = 'public, max-age=31536000, immutable'
    let body = readFileSync(file)
    if (COMPRESSIBLE.has(ext)) {
      if (!compressed.has(file)) {
        compressed.set(
          file,
          brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }),
        )
      }
      body = compressed.get(file)
      headers['content-encoding'] = 'br'
    }
    res.writeHead(200, headers)
    res.end(body)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

async function lighthouse(url, formFactor, outFile) {
  const flags = [
    url,
    '--quiet',
    '--output=json',
    `--output-path=${outFile}`,
    `--only-categories=${CATEGORIES.join(',')}`,
    '--throttling-method=simulate',
    '"--chrome-flags=--headless=new --no-sandbox --disable-gpu"',
  ]
  if (formFactor === 'desktop') flags.push('--preset=desktop')
  const [command, ...prefix] = (process.env.LIGHTHOUSE_BIN ?? 'pnpm dlx lighthouse@latest').split(' ')
  // Async on purpose: this process also serves the page, so a sync spawn would
  // deadlock Chrome against a server that can never answer.
  const child = spawn(command, [...prefix, ...flags], {
    shell: true,
    timeout: LIGHTHOUSE_TIMEOUT_MS,
  })
  let stderr = ''
  child.stderr.on('data', (chunk) => (stderr += chunk))
  await once(child, 'close')
  if (!existsSync(outFile)) {
    throw new Error(`lighthouse wrote no report for ${url}: ${stderr.slice(-400)}`)
  }
  return JSON.parse(readFileSync(outFile, 'utf8'))
}

function median(values) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
}

function summarize(reports) {
  const score = (id) => Math.round(median(reports.map((r) => r.categories[id].score)) * 100)
  const metric = (id) => median(reports.map((r) => r.audits[id].numericValue))
  return {
    perf: score('performance'),
    a11y: score('accessibility'),
    bp: score('best-practices'),
    seo: score('seo'),
    fcp: Math.round(metric('first-contentful-paint')),
    si: Math.round(metric('speed-index')),
    lcp: Math.round(metric('largest-contentful-paint')),
    tbt: Math.round(metric('total-blocking-time')),
    cls: Number(metric('cumulative-layout-shift').toFixed(3)),
    kb: Math.round(metric('total-byte-weight') / 1024),
  }
}

/** Every audit that lost points in any run, once, so the next fix is named. */
function failingAudits(reports) {
  const failing = new Map()
  for (const report of reports) {
    for (const audit of Object.values(report.audits)) {
      const failed = audit.score !== null && audit.score < 0.9
      if (failed && audit.scoreDisplayMode !== 'informative') {
        failing.set(audit.id, audit.displayValue ?? '')
      }
    }
  }
  return [...failing].map(([id, value]) => (value ? `${id} (${value})` : id))
}

const baseUrl = arg('url', null)
const routes = arg('routes', DEFAULT_ROUTES.join(',')).split(',')
const runs = Number(arg('runs', '3'))
const min = Number(arg('min', '95'))

if (!baseUrl && !existsSync(join(OUT_DIR, 'index.html'))) {
  throw new Error('out/index.html is missing: run `pnpm cf:build` first')
}

const server = baseUrl ? null : await serve()
const origin = baseUrl ?? `http://127.0.0.1:${server.address().port}`
const scratch = mkdtempSync(join(tmpdir(), 'perf-audit-'))
console.log(`Auditing ${origin} (${baseUrl ? 'live' : 'local out/ with Brotli'}), median of ${runs}`)
console.log(`Full reports: ${scratch}`)

const problems = []
for (const route of routes) {
  for (const formFactor of ['mobile', 'desktop']) {
    const reports = []
    for (let run = 0; run < runs; run += 1) {
      const outFile = join(scratch, `${formFactor}-${run}.json`)
      reports.push(await lighthouse(`${origin}${route}`, formFactor, outFile))
    }
    const s = summarize(reports)
    console.log(
      `${route.padEnd(24)} ${formFactor.padEnd(7)} P${s.perf} A${s.a11y} BP${s.bp} SEO${s.seo}  ` +
        `FCP ${s.fcp}ms SI ${s.si}ms LCP ${s.lcp}ms TBT ${s.tbt}ms CLS ${s.cls}  ${s.kb} KiB`,
    )
    const failing = failingAudits(reports)
    if (failing.length) console.log(`  failing: ${failing.join(', ')}`)
    for (const [name, value] of Object.entries({ P: s.perf, A: s.a11y, BP: s.bp, SEO: s.seo })) {
      if (value < min) problems.push(`${route} ${formFactor}: ${name} ${value} < ${min}`)
    }
    if (formFactor === 'mobile') {
      if (s.lcp > BUDGET.lcpMs) problems.push(`${route}: LCP ${s.lcp}ms > ${BUDGET.lcpMs}ms`)
      if (s.tbt > BUDGET.tbtMs) problems.push(`${route}: TBT ${s.tbt}ms > ${BUDGET.tbtMs}ms`)
      if (s.cls > BUDGET.cls) problems.push(`${route}: CLS ${s.cls} > ${BUDGET.cls}`)
    }
  }
}

server?.close()
if (problems.length) {
  console.error(`\nOver budget:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('\nAll routes within budget.')
