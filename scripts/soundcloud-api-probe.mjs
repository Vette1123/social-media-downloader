/**
 * One-run verification of the SoundCloud API-v2 pattern from a datacenter
 * egress (GitHub Actions, the same vantage class as the Worker):
 *
 *   track page -> a.sndcdn.com asset bundle -> client_id
 *   -> api-v2.soundcloud.com/resolve ?url=..&client_id=..
 *   -> progressive translation URL
 *
 * Nothing here ships to production until these exits all pass; a wall on any
 * step is the same verdict triage the cf-smoke file documents for probe
 * entries: never guess a probe URL, never merge blind.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const TRACK = process.argv[2] ?? 'https://soundcloud.com/forss/flickermood'

const page = await fetch(TRACK, {
  headers: { 'User-Agent': UA },
  signal: AbortSignal.timeout(30_000),
})
const pageText = await page.text()
console.log('page', page.status, pageText.length)
if (!page.ok || pageText.length < 2048) {
  console.error('WALL: the track page is under the real-page floor')
  process.exit(1)
}

const assets = [...pageText.matchAll(/https:\/\/a\.sndcdn\.com\/assets\/[\w-]+\.js/g)].map(
  (m) => m[0],
)
console.log('assets', assets.length)
if (assets.length === 0) {
  console.error('NO ASSETS: page shape changed')
  process.exit(1)
}

let clientId = null
let source = null
for (const asset of [...assets].reverse()) {
  const res = await fetch(asset, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) continue
  const body = await res.text()
  const m =
    /client_id\s*[:=]\s*"([\w-]{18,})"/.exec(body) ??
    /"client_id":"([\w-]{18,})"/.exec(body) ??
    /(?:"|"client_id")([\w-]{18,})/.exec(body)
  if (m) {
    clientId = m[1]
    source = asset.slice(-28)
    break
  }
}
if (!clientId) {
  console.error('NO CLIENT ID in the asset bundles scanned')
  process.exit(1)
}
console.log('client_id', clientId, 'from', source)

const api = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(TRACK)}&client_id=${clientId}`
const apiRes = await fetch(api, {
  headers: { 'User-Agent': UA },
  signal: AbortSignal.timeout(30_000),
})
const apiText = await apiRes.text()
console.log('resolve', apiRes.status, apiText.slice(0, 400))
if (!apiRes.ok) {
  console.error('RESOLVE FAIL: client_id or endpoint refused')
  process.exit(1)
}
