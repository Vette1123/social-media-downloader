/**
 * Faithful replica of Downloader.trySoundcloudTrack, run from datacenter egress
 * (GitHub Actions) so each step can be seen failing or passing before the
 * extractor ships — and again after, to separate a logic bug from a
 * Cloudflare-egress difference.
 *
 * Chain: homepage -> client_id candidates (hydrate block, then a-v2 bundles)
 *        -> api-v2 /resolve -> media.transcodings progressive mp3
 *        -> transcoding url + client_id + track_authorization -> {url}
 *
 * The homepage carries more than one client id and they are not equal: the
 * hydrate block and the asset bundles can answer different preset sets. This
 * script tries every candidate until one yields a progressive stream, which is
 * the behaviour the extractor needs.
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

// 2. collect every client id the homepage offers.
const candidates = []
const hydrateId =
  /"hydratable"\s*:\s*"apiClient"\s*,\s*"data"\s*:\s*\{\s*"id"\s*:\s*"([^"]+)"/.exec(
    html,
  )?.[1]
if (hydrateId) candidates.push(['hydrate', hydrateId])
const assets = [
  ...html.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/[^"]+)"/g),
].map((m) => m[1])
console.log('a-v2 assets on homepage:', assets.length)
for (const asset of assets) {
  const bundle = await get(asset)
  if (bundle.status !== 200) {
    console.log('  bundle', bundle.status, asset)
    continue
  }
  const body = await bundle.text()
  const id = /,client_id:"([A-Za-z0-9]{32})",/.exec(body)?.[1]
  if (id) candidates.push([asset, id])
}
console.log('client id candidates:', candidates.map((c) => c[1]).join(', '))
if (candidates.length === 0) {
  console.error('NO CLIENT ID anywhere on the homepage')
  process.exit(1)
}

// 3. try each candidate until one yields a progressive stream.
let track = null
let streaming = null
let chosenId = null
for (const [source, id] of candidates) {
  const resolve = await get(
    `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(
      TRACK,
    )}&client_id=${id}`,
    { Accept: 'application/json' },
  )
  if (resolve.status !== 200) {
    console.log('resolve', resolve.status, 'for', source)
    continue
  }
  const t = JSON.parse(await resolve.text())
  const tc = t.media?.transcodings ?? []
  const protocols = [...new Set(tc.map((x) => x.format?.protocol))].join('+')
  console.log('resolve', t.id, source, 'protocols:', protocols)
  const s =
    tc.find(
      (x) =>
        !x.snipped &&
        x.format?.protocol === 'progressive' &&
        x.preset === 'mp3_1',
    ) ||
    tc.find(
      (x) =>
        !x.snipped &&
        x.format?.protocol === 'progressive' &&
        x.preset?.startsWith('mp3_'),
    ) ||
    tc.find((x) => !x.snipped && x.format?.protocol === 'progressive')
  if (s?.url && t.track_authorization) {
    track = t
    streaming = s
    chosenId = id
    console.log('CHOSEN', source, s.preset, s.url)
    break
  }
}
if (!streaming) {
  console.error('NO CANDIDATE YIELDED A PROGRESSIVE STREAM')
  process.exit(1)
}

// 4. the direct file
const fileUrl = new URL(streaming.url)
fileUrl.searchParams.set('client_id', chosenId)
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
