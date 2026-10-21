/**
 * Faithful replica of Downloader.trySoundcloudTrack, run from datacenter egress
 * (GitHub Actions) so each step can be seen failing or passing before the
 * extractor ships — and again after, to separate a logic bug from a
 * Cloudflare-egress difference.
 *
 * Chain: homepage -> client_id (hydrate block, else a-v2 bundle)
 *        -> api-v2 /resolve -> media.transcodings progressive mp3
 *        -> transcoding url + client_id + track_authorization -> {url}
 *
 * Nothing here ships to production until every step passes; a wall on any step
 * is the same verdict triage the cf-smoke file documents for probe entries.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const TRACK = process.argv[2] ?? 'https://soundcloud.com/forss/flickermood'

const get = (url, headers = {}) =>
  fetch(url, {
    headers: { 'User-Agent': UA, ...headers },
    signal: AbortSignal.timeout(30_000),
  })

// 1. homepage — the extractor reads the client id off the site root, not the
//    track page, so this is the page that has to carry it.
const homepage = await get('https://soundcloud.com/', { Accept: 'text/html' })
const html = await homepage.text()
console.log('homepage', homepage.status, html.length, 'bytes')
if (homepage.status !== 200 || html.length < 2048) {
  console.error('WALL: homepage is not a real page')
  process.exit(1)
}

// 2. client id — hydrate block first, then the a-v2 bundles.
let clientId =
  /"hydratable"\s*:\s*"apiClient"\s*,\s*"data"\s*:\s*\{\s*"id"\s*:\s*"([^"]+)"/.exec(
    html,
  )?.[1] || ''
if (clientId) {
  console.log('client_id', clientId, 'from hydrate block')
} else {
  const assets = [
    ...html.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/[^"]+)"/g),
  ].map((m) => m[1])
  console.log('a-v2 assets on homepage:', assets.length)
  for (const asset of assets) {
    if (clientId) break
    const bundle = await get(asset)
    if (bundle.status !== 200) {
      console.log('  bundle', bundle.status, asset)
      continue
    }
    const body = await bundle.text()
    clientId = /,client_id:"([A-Za-z0-9]{32})",/.exec(body)?.[1] || ''
    if (clientId) {
      console.log('client_id', clientId, 'from', asset)
    }
  }
}
if (!clientId) {
  console.error('NO CLIENT ID: hydrate block and a-v2 bundles both empty')
  console.error('  hydratable present:', /hydratable/.test(html))
  console.error('  client_id mention in html:', /client_id/.test(html))
  process.exit(1)
}

// 3. resolve
const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(
  TRACK,
)}&client_id=${clientId}`
const resolve = await get(resolveUrl, { Accept: 'application/json' })
const resolveText = await resolve.text()
console.log('resolve', resolve.status, resolveText.length, 'bytes')
if (resolve.status !== 200) {
  console.error('RESOLVE FAIL: client_id or endpoint refused')
  process.exit(1)
}
const track = JSON.parse(resolveText)
console.log(
  'track id',
  track.id,
  'policy',
  track.policy,
  'downloadable',
  track.downloadable,
)
const transcodings = track.media?.transcodings ?? []
console.log('transcodings', transcodings.length)
for (const t of transcodings) {
  console.log(
    '  ',
    t.preset,
    t.format?.protocol,
    'snipped=' + !!t.snipped,
    String(t.url).slice(0, 90),
  )
}
if (transcodings.length === 0) {
  console.error('NO TRANSCODINGS: resolve answered without media.transcodings')
  console.error('  media keys:', Object.keys(track.media ?? {}))
  process.exit(1)
}

// 4. pick the progressive mp3 — same three-tier preference as the extractor.
const streaming =
  transcodings.find(
    (t) =>
      !t.snipped &&
      t.format?.protocol === 'progressive' &&
      t.preset === 'mp3_1',
  ) ||
  transcodings.find(
    (t) =>
      !t.snipped &&
      t.format?.protocol === 'progressive' &&
      t.preset?.startsWith('mp3_'),
  ) ||
  transcodings.find((t) => !t.snipped && t.format?.protocol === 'progressive')
if (!streaming?.url || !track.track_authorization) {
  console.error(
    'NO PROGRESSIVE: streaming=' + !!streaming?.url,
    'auth=' + !!track.track_authorization,
  )
  process.exit(1)
}
console.log('streaming', streaming.preset, streaming.url)

// 5. the direct file
const fileUrl = new URL(streaming.url)
fileUrl.searchParams.set('client_id', clientId)
fileUrl.searchParams.set('track_authorization', track.track_authorization)
const stream = await get(fileUrl.toString(), { Accept: 'application/json' })
const streamText = await stream.text()
console.log('stream', stream.status, streamText.slice(0, 200))
if (stream.status !== 200) {
  console.error('STREAM FAIL')
  process.exit(1)
}
let direct
try {
  direct = JSON.parse(streamText).url
} catch {
  console.error('stream did not answer JSON')
  process.exit(1)
}
console.log('direct', direct)
if (!direct || /\.m3u8($|\?)/.test(direct)) {
  console.error('DIRECT IS NOT A FILE')
  process.exit(1)
}
console.log('PASS: the extractor chain resolves from datacenter egress')
