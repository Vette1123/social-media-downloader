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

const assets = [...pageText.matchAll(/https:\/\/[\w.-]*\.sndcdn\.com\/[^"'\\\s]+\.js/g)].map(
  (m) => m[0],
)
console.log('assets', assets.length)
if (assets.length === 0) {
  // Dump the shapes the page actually ships, so the pattern-alimony lands in
  // the next edit rather than a second blind run.
  const mentions = [...pageText.matchAll(/(?:"|\{)[^"'{}\s,]{0,80}sndcdn[^"'{}\s,]{0,80}/g)].map(
    (m) => m[0],
  )
  const unique = [...new Set(mentions)].slice(0, 20)
  console.error('NO ASSETS from the old pattern. Mentions of sndcdn in the page:')
  for (const line of unique) console.error(' ', line.slice(0, 120))
  console.error('client_id in page html:', /client_id/.test(pageText))
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

const track = JSON.parse(apiText)
console.log(
  'media.translations', track.media?.translations?.length ?? 'absent',
  'media.transcriptions', track.media?.transcriptions?.length ?? 'absent',
  'downloadable', track.downloadable,
  'id', track.id,
)

// The resolve answer speaks metadata; the per-track endpoint speaks media.
const trackRes = await fetch(
  `https://api-v2.soundcloud.com/tracks/${track.id}?client_id=${clientId}`,
  { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) },
)
const trackText = await trackRes.text()
const track2 = JSON.parse(trackText)
console.log('tracks/<id>', trackRes.status)
console.log(
  '  translations', track2.media?.translations?.length,
  'transcriptions', track2.media?.transcriptions?.length,
  'auth', !!track2.track_authorization,
)
for (const t of track2.media?.translations ?? []) console.log('  translation', t)
for (const t of track2.media?.transcriptions ?? []) console.log('  transcription', t)

// What the SSR page itself ships: several scrapers read the track JSON
// straight out of the HTML instead of trusting the app API at all.
const inPage = [...new Set(
  pageText.match(/[^\s"'{}]+\.mp3[^\s"'{}]*/g) ?? [],
)].slice(0, 5)
console.log('page .mp3 hits', inPage.length, inPage)


// The byte probe decides whether a translation is streamable or a dead link —
// only audio bytes at Range 0-15 make this extractable.
const translation = track.media.translations[0]
console.log('translation', translation)
const media = await fetch(translation, {
  headers: { 'User-Agent': UA, Range: 'bytes=0-15' },
  signal: AbortSignal.timeout(30_000),
})
const head = new Uint8Array(await media.arrayBuffer())
console.log(
  'bytes', media.status,
  media.headers.get('content-type'),
  media.headers.get('content-range'),
  [...head].map((b) => b.toString(16).padStart(2, '0')).join(' '),
)
