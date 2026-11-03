/**
 * Submits the site's changed URLs to IndexNow so participating engines
 * (Bing, Yandex, Seznam, Naver, ...) re-crawl them within minutes instead of
 * waiting for their normal cycle. One POST notifies all of them.
 *
 *   indexnow.mjs --plan F    BEFORE the deploy: compare out/ with the live site,
 *                            write the changed URLs and why to F
 *   indexnow.mjs --submit F  AFTER the deploy: submit what F lists
 *   pnpm indexnow            plan and submit in one go (CI on main, or --force)
 *   --dry-run                print the set and reasons, submit nothing (any env)
 *   --all                    treat every URL in out/sitemap.xml as changed
 *   --force                  submit outside a push to main
 *
 * "Changed" means new to the live sitemap, dropped from it, or a built page
 * whose fingerprint (scripts/lib/indexnow-diff.mjs) differs from the page live
 * right now. That comparison only means something before the deploy goes out,
 * while the previous version still answers, which is why planning and
 * submitting are separate steps. If the live sitemap cannot be read, every URL
 * is submitted and the log says so. A missing plan file does the same.
 *
 * The deploy workflow runs plan then submit around `wrangler deploy`. Every
 * failure is logged and swallowed: a flaky search-engine endpoint must never
 * fail a deploy.
 *
 * Ownership: public/<key>.txt is served at the site root. IndexNow fetches it
 * to confirm we own the host before honoring the submission.
 * See https://www.bing.com/indexnow/getstarted
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  changeReason,
  htmlRouteFor,
  removedUrls,
  sitemapUrls,
} from './lib/indexnow-diff.mjs'

// Matches public/f62bfbe4672c27f2ad3204b176eaab35.txt — the two must agree.
const INDEXNOW_KEY = 'f62bfbe4672c27f2ad3204b176eaab35'
// The shared endpoint fans one submission out to every participating engine.
const ENDPOINT = 'https://api.indexnow.org/IndexNow'
const OUT_DIR = 'out'

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.socialdownloader.space'
).replace(/\/+$/, '')
const host = new URL(baseUrl).host
const FETCH_HEADERS = { 'User-Agent': 'socialdownloader-indexnow/1.0' }

async function fetchText(url) {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

function readBuilt(file) {
  const path = join(OUT_DIR, file)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

/** Runs `fn` over `items`, `size` at a time, so ~80 page fetches don't hit the edge at once. */
async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn))
  }
}

/** `{ url: reason }` for what this build changes. */
async function buildPlan(all) {
  const builtXml = readBuilt('sitemap.xml')
  if (!builtXml) throw new Error('out/sitemap.xml is missing: run pnpm cf:build first')
  const urls = [...sitemapUrls(builtXml)]
  const every = (reason) => Object.fromEntries(urls.map((u) => [u, reason]))
  if (all) return every('all')

  const liveXml = await fetchText(`${baseUrl}/sitemap.xml`)
  if (liveXml === null) {
    console.warn(`IndexNow: live sitemap unreadable, planning all ${urls.length} URLs.`)
    return every('live-sitemap-unreadable')
  }
  const liveSitemap = sitemapUrls(liveXml)
  const reasons = {}
  await inBatches(urls, 10, async (url) => {
    const route = htmlRouteFor(url, baseUrl)
    const built = route ? readBuilt(route) : null
    const live = built !== null && liveSitemap.has(url) ? await fetchText(url) : null
    const reason = changeReason({ url, liveSitemap, built, live })
    if (reason) reasons[url] = reason
  })
  for (const url of removedUrls(liveSitemap, new Set(urls))) reasons[url] = 'removed'
  console.log(`IndexNow: ${Object.keys(reasons).length} of ${urls.length} URLs changed vs the live site.`)
  return reasons
}

function printPlan(plan) {
  for (const [url, reason] of Object.entries(plan)) console.log(`  ${reason}  ${url}`)
}

async function submit(urlList) {
  if (!urlList.length) {
    console.log('IndexNow: no page changed in this deploy, nothing to submit')
    return
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${baseUrl}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  })
  // 200 OK and 202 Accepted both mean the submission was received.
  console.log(`IndexNow: submitted ${urlList.length} URLs -> ${res.status} ${res.statusText}`)
  if (!res.ok && res.status !== 202) {
    const body = await res.text().catch(() => '')
    console.warn(`IndexNow: non-success response body: ${body.slice(0, 500)}`)
  }
}

/** After the deploy: send what the plan lists. No plan means planning died, so send all. */
async function submitPlan(file) {
  if (existsSync(file)) return submit(Object.keys(JSON.parse(readFileSync(file, 'utf8'))))
  console.warn('IndexNow: no plan file, submitting every URL in the live sitemap')
  const xml = await fetchText(`${baseUrl}/sitemap.xml`)
  return submit(xml ? [...sitemapUrls(xml)] : [`${baseUrl}/`])
}

async function main() {
  const args = process.argv.slice(2)
  const valueOf = (name) => args[args.indexOf(name) + 1]
  const dryRun = args.includes('--dry-run')
  const all = args.includes('--all')

  if (args.includes('--submit') && !dryRun) return submitPlan(valueOf('--submit'))

  if (args.includes('--plan')) {
    const plan = await buildPlan(all)
    printPlan(plan)
    if (dryRun) return console.log('IndexNow: --dry-run, no plan written.')
    return writeFileSync(valueOf('--plan'), JSON.stringify(plan, null, 2))
  }

  const onMain =
    process.env.GITHUB_REF === 'refs/heads/main' &&
    process.env.GITHUB_EVENT_NAME !== 'pull_request'
  if (!dryRun && !args.includes('--force') && !onMain) {
    console.log('IndexNow: skipped (not a push to main; pass --force or --dry-run).')
    return
  }
  const plan = await buildPlan(all)
  printPlan(plan)
  if (dryRun) return console.log('IndexNow: --dry-run, nothing submitted.')
  await submit(Object.keys(plan))
}

// Best-effort: log any failure but always exit 0 so a search-engine ping can
// never fail the build it runs inside. Guarded so importing this file in a
// test cannot fire a real submission.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.warn(`IndexNow: failed (ignored): ${String(err)}`)
  })
}
