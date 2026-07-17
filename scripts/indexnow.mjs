/**
 * Submits the site's canonical URLs to IndexNow so participating engines
 * (Bing, Yandex, Seznam, Naver, …) re-crawl changed pages within minutes
 * instead of waiting for their normal cycle. One POST notifies all of them.
 *
 *   pnpm indexnow          submit every canonical URL
 *   pnpm indexnow --force  submit even outside a Vercel production build
 *
 * Wired as `postbuild` (see package.json + .npmrc `enable-pre-post-scripts`),
 * so every production deploy pings automatically. A guard skips local/preview
 * builds, and every failure is logged and swallowed — a flaky search-engine
 * endpoint must never fail a deploy.
 *
 * Ownership: public/<key>.txt is served at the site root. IndexNow fetches it
 * to confirm we own the host before honoring the submission.
 * See https://www.bing.com/indexnow/getstarted
 */

// Matches public/f62bfbe4672c27f2ad3204b176eaab35.txt — the two must agree.
const INDEXNOW_KEY = 'f62bfbe4672c27f2ad3204b176eaab35'
// The shared endpoint fans one submission out to every participating engine.
const ENDPOINT = 'https://api.indexnow.org/IndexNow'

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.socialdownloader.space'
).replace(/\/+$/, '')
const host = new URL(baseUrl).host

/**
 * Pulls the canonical URL set straight from the deployed sitemap so the two
 * never drift; falls back to just the homepage if the sitemap is unreachable.
 */
async function collectUrls() {
  try {
    const res = await fetch(`${baseUrl}/sitemap.xml`, {
      headers: { 'User-Agent': 'socialdownloader-indexnow/1.0' },
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

async function main() {
  const force = process.argv.includes('--force')
  const isVercelProd = process.env.VERCEL_ENV === 'production'
  if (!force && !isVercelProd) {
    console.log(
      `IndexNow: skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'}; pass --force to submit anyway).`
    )
    return
  }

  const urlList = await collectUrls()
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
// never fail the build it runs inside.
main().catch((err) => {
  console.warn(`IndexNow: submission failed (ignored): ${String(err)}`)
})
