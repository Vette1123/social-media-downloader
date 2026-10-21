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
 * script tries every candidate against real chart tracks until one combination
 * yields a progressive stream, which is the behaviour the extractor needs.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const ARG = process.argv[2]

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
  if (bundle.status !== 200) continue
  const body = await bundle.text()
  const id = /,client_id:"([A-Za-z0-9]{32})",/.exec(body)?.[1]
  if (id) candidates.push([asset, id])
}
console.log('client id candidates:', candidates.map((c) => c[1]).join(', '))
if (candidates.length === 0) {
  console.error('NO CLIENT ID anywhere on the homepage')
  process.exit(1)
}

// 3. the track list: the argument, or the live top chart so the test never
//    depends on a remembered slug.
let tracks = []
if (ARG) {
  tracks = ARG.split(',').map((s) => s.trim()).filter(Boolean)
} else {
  for (const q of ['techno', 'house', 'hip hop']) {
    const search = await get(
      `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(
        q,
      )}&limit=8&client_id=${candidates[0][1]}`,
      { Accept: 'application/json' },
    )
    const searchText = await search.text()
    console.log('search', q, search.status, searchText.slice(0, 120))
    if (search.status === 200) {
      const list = JSON.parse(searchText)
      for (const t of list.collection ?? []) {
        if (t.permalink_url) tracks.push(t.permalink_url)
      }
    }
    if (tracks.length > 0) break
  }
  console.log('search tracks:', tracks.length)
}
if (tracks.length === 0) {
  console.error('NO TRACKS to test')
  process.exit(1)
}

const pick = (tc) =>
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

// 4. try every track x client id until one yields a progressive stream.
let chosen = null
for (const trackUrl of tracks) {
  for (const [source, id] of candidates) {
    const resolve = await get(
      `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(
        trackUrl,
      )}&client_id=${id}`,
      { Accept: 'application/json' },
    )
    if (resolve.status !== 200) {
      console.log('resolve', resolve.status, trackUrl, source)
      continue
    }
    const t = JSON.parse(await resolve.text())
    console.log(
      '  track',
      t.id,
      'downloadable=' + t.downloadable,
      'streamable=' + t.streamable,
      'policy=' + t.policy,
      'download_url=' + (t.download_url ?? '-'),
    )
    const tc = t.media?.transcodings ?? []
    const protocols = [...new Set(tc.map((x) => x.format?.protocol))].join('+')
    const s = pick(tc)
    console.log(
      'resolve',
      t.id,
      protocols,
      s?.preset ?? '-',
      trackUrl,
      source,
    )
    // A downloadable track carries its own single-file endpoint; worth testing
    // even when the transcodings are HLS-only.
    if (t.downloadable && t.download_url) {
      const sep = t.download_url.includes('?') ? '&' : '?'
      const dl = await get(`${t.download_url}${sep}client_id=${id}`)
      const dlText = await dl.text()
      console.log(
        '  download endpoint',
        dl.status,
        dl.headers.get('content-type'),
        'loc=' + dl.headers.get('location'),
        dlText.slice(0, 120),
      )
    }
    if (s?.url && t.track_authorization) {
      chosen = { track: t, streaming: s, id, source, trackUrl }
      break
    }
  }
  if (chosen) break
}
if (!chosen) {
  console.error('NO TRACK X CLIENT ID YIELDED A PROGRESSIVE STREAM')
  process.exit(1)
}
console.log('CHOSEN', chosen.source, chosen.streaming.preset, chosen.trackUrl)

// 5. the direct file
const fileUrl = new URL(chosen.streaming.url)
fileUrl.searchParams.set('client_id', chosen.id)
fileUrl.searchParams.set('track_authorization', chosen.track.track_authorization)
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
