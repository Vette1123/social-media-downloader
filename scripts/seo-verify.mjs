#!/usr/bin/env node
/**
 * Every page in the sitemap, checked the way a search engine would read it.
 *
 *   node scripts/seo-verify.mjs          the build in out/: each sitemap URL has
 *                                        a title, a description, a self-canonical,
 *                                        no noindex, and hreflang that stays inside
 *                                        the sitemap. Runs BEFORE the deploy, so a
 *                                        broken head never ships.
 *   node scripts/seo-verify.mjs --live   the same URLs on the live origin: 200 with
 *                                        no redirect, and the head equal to the
 *                                        build's. Runs AFTER the deploy; retries for
 *                                        edge propagation before it fails.
 *
 * Exits 1 with the count and the first failures. Needs `pnpm cf:build` first.
 * Limit: it reads the head only. Body content and JSON-LD are covered by the
 * unit tests and the IndexNow fingerprint, not here.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { htmlRouteFor, sitemapUrls } from './lib/indexnow-diff.mjs'
import { builtProblems, liveDrift, seoHead } from './lib/seo-head.mjs'

const OUT_DIR = 'out'
const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.socialdownloader.space'
).replace(/\/+$/, '')
// First-party name: the WAF challenges scripted-client strings and empty UAs only.
const HEADERS = { 'User-Agent': 'socialdownloader-seo-verify/1.0' }
const LIVE = process.argv.includes('--live')
const ATTEMPTS = 4
const RETRY_MS = 15_000
const CONCURRENCY = 4

const fail = (msg) => {
  console.error(`seo-verify: ${msg}`)
  process.exit(1)
}

const sitemapPath = join(OUT_DIR, 'sitemap.xml')
if (!existsSync(sitemapPath)) fail(`${sitemapPath} missing; run \`pnpm cf:build\` first`)
const sitemap = sitemapUrls(readFileSync(sitemapPath, 'utf8'))
if (sitemap.size === 0) fail('the built sitemap lists 0 URLs')

const built = new Map()
const failures = []
for (const url of sitemap) {
  const file = htmlRouteFor(url, baseUrl)
  const path = file && join(OUT_DIR, file)
  if (!path || !existsSync(path)) {
    failures.push(`${url}: no built page (${file ?? 'outside ' + baseUrl})`)
    continue
  }
  const head = seoHead(readFileSync(path, 'utf8'))
  built.set(url, head)
  for (const p of builtProblems(url, head, sitemap)) failures.push(`${url}: ${p}`)
}

async function liveProblem(url) {
  let res
  try {
    res = await fetch(url, { headers: HEADERS, redirect: 'manual' })
  } catch (err) {
    return `fetch failed (${err.cause?.code ?? err.message})`
  }
  if (res.status !== 200) return `HTTP ${res.status}${res.headers.get('location') ? ' -> ' + res.headers.get('location') : ''}`
  const drift = liveDrift(built.get(url), seoHead(await res.text()))
  return drift.length ? `live head differs from the build: ${drift.join(', ')}` : null
}

async function checkLive(urls) {
  const bad = new Map()
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    await Promise.all(
      urls.slice(i, i + CONCURRENCY).map(async (url) => {
        const p = await liveProblem(url)
        if (p) bad.set(url, p)
      }),
    )
  }
  return bad
}

if (failures.length === 0 && LIVE) {
  let pending = [...built.keys()]
  for (let attempt = 1; attempt <= ATTEMPTS && pending.length; attempt++) {
    if (attempt > 1) {
      console.log(`seo-verify: ${pending.length} live page(s) not matching yet; retry ${attempt}/${ATTEMPTS} in ${RETRY_MS / 1000}s`)
      await new Promise((r) => setTimeout(r, RETRY_MS))
    }
    const bad = await checkLive(pending)
    pending = [...bad.keys()]
    if (attempt === ATTEMPTS) for (const [url, p] of bad) failures.push(`${url}: ${p}`)
  }
}

const what = LIVE ? `live ${baseUrl}` : `build in ${OUT_DIR}/`
if (failures.length) {
  console.error(`seo-verify: ${failures.length} problem(s) across ${sitemap.size} sitemap URLs (${what}):`)
  for (const f of failures.slice(0, 25)) console.error(`  - ${f}`)
  if (failures.length > 25) console.error(`  … and ${failures.length - 25} more`)
  process.exit(1)
}
console.log(`seo-verify: ${sitemap.size}/${sitemap.size} sitemap URLs pass (${what})`)
