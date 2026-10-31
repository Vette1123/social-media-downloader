/**
 * Submits the site's changed URLs to IndexNow so participating engines
 * (Bing, Yandex, Seznam, Naver, …) re-crawl them within minutes instead of
 * waiting for their normal cycle. One POST notifies all of them.
 *
 *   pnpm indexnow                 submit every canonical URL (by hand, rarely)
 *   indexnow.mjs --snapshot F     save the live sitemap to F, before a deploy
 *   indexnow.mjs --since F        submit what moved between F and out/sitemap.xml
 *
 * The deploy workflow runs the last two around every production deploy. A deploy
 * changes no page most of the time, and resubmitting all of them each time asks
 * the engine to spend its crawl on pages it already has.
 *
 * Every failure is logged and swallowed: a flaky search-engine endpoint must
 * never fail a deploy.
 *
 * Ownership: public/<key>.txt is served at the site root. IndexNow fetches it
 * to confirm we own the host before honoring the submission.
 * See https://www.bing.com/indexnow/getstarted
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Matches public/f62bfbe4672c27f2ad3204b176eaab35.txt — the two must agree.
const INDEXNOW_KEY = 'f62bfbe4672c27f2ad3204b176eaab35'
// The shared endpoint fans one submission out to every participating engine.
const ENDPOINT = 'https://api.indexnow.org/IndexNow'

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.socialdownloader.space'
).replace(/\/+$/, '')
const host = new URL(baseUrl).host
const SITEMAP_HEADERS = { 'User-Agent': 'socialdownloader-indexnow/1.0' }

/** `<loc>` → `<lastmod>`. `<image:loc>` does not match, so images stay out. */
function parseSitemap(xml) {
  const pages = new Map()
  for (const [, entry] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1].trim()
    if (loc) pages.set(loc, entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1])
  }
  return pages
}

/**
 * The URLs that differ between two sitemaps: new, re-dated or removed. A removed
 * URL is sent too, so engines recrawl it, see the 404 and drop it. Returns null
 * when `beforeXml` holds no URLs, because that is a bad baseline, not an empty site.
 */
export function changedUrls(beforeXml, afterXml) {
  const before = parseSitemap(beforeXml)
  if (!before.size) return null
  const after = parseSitemap(afterXml)
  const moved = [...after].filter(([loc, lastmod]) => before.get(loc) !== lastmod)
  const removed = [...before.keys()].filter((loc) => !after.has(loc))
  return [...moved.map(([loc]) => loc), ...removed]
}

/**
 * Pulls the canonical URL set straight from the deployed sitemap so the two
 * never drift; falls back to just the homepage if the sitemap is unreachable.
 */
async function collectUrls() {
  try {
    const res = await fetch(`${baseUrl}/sitemap.xml`, {
      headers: SITEMAP_HEADERS,
    })
    if (res.ok) {
      const xml = await res.text()
      const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
        m[1].trim()
      )
      if (urls.length) return [...new Set(urls)]
    }
  } catch {
    /* fall through to the homepage */
  }
  return [`${baseUrl}/`]
}

/** Saves the sitemap that is live now. A failure leaves no file: `--since` copes. */
async function snapshot(file) {
  const res = await fetch(`${baseUrl}/sitemap.xml`, { headers: SITEMAP_HEADERS })
  if (!res.ok) throw new Error(`sitemap answered ${res.status}`)
  const xml = await res.text()
  writeFileSync(file, xml)
  console.log(`IndexNow: saved ${parseSitemap(xml).size} URLs as the baseline`)
}

/**
 * What to submit after a deploy. Reads the built sitemap rather than the live
 * one: the deploy already succeeded, and a stale edge copy would read as "nothing
 * changed". With no usable baseline it submits everything, the safe direction.
 */
async function urlsSince(file) {
  const before = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const urls = changedUrls(before, readFileSync('out/sitemap.xml', 'utf8'))
  if (urls) return urls
  console.warn('IndexNow: no usable baseline, submitting every URL')
  return collectUrls()
}

async function main() {
  const flag = process.argv[2]
  if (flag === '--snapshot') return snapshot(process.argv[3])
  const urlList =
    flag === '--since' ? await urlsSince(process.argv[3]) : await collectUrls()
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
  console.log(
    `IndexNow: submitted ${urlList.length} URLs → ${res.status} ${res.statusText}`
  )
  if (!res.ok && res.status !== 202) {
    const body = await res.text().catch(() => '')
    console.warn(`IndexNow: non-success response body: ${body.slice(0, 500)}`)
  }
}

// Best-effort: log any failure but always exit 0 so a search-engine ping can
// never fail the build it runs inside. Guarded so importing the helpers in a
// test cannot fire a real submission.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.warn(`IndexNow: submission failed (ignored): ${String(err)}`)
  })
}
