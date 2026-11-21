import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { googleJwt, sitemapFeeds, submitSitemaps } from './search-engines.mjs'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const SA = JSON.stringify({
  client_email: 'bot@x.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
})
const ROOT = 'https://www.socialdownloader.space/sitemap.xml'
const INDEX = `<sitemapindex xmlns="x">
<sitemap><loc>https://www.socialdownloader.space/sitemaps/a.xml</loc></sitemap>
<sitemap><loc>https://www.socialdownloader.space/sitemaps/b.xml</loc></sitemap>
</sitemapindex>`

function fakeFetch(status) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    if (url.includes('oauth2'))
      return new Response(JSON.stringify({ access_token: 't' }))
    return new Response('nope', { status: status(url) })
  }
  return { calls, impl }
}
const target = {
  feeds: [ROOT],
  gscSite: 'sc-domain:socialdownloader.space',
  bingSite: 'https://socialdownloader.space',
}

describe('sitemapFeeds', () => {
  it('lists every child of an index, so none goes unread', () => {
    expect(sitemapFeeds(ROOT, INDEX)).toEqual([
      ROOT,
      'https://www.socialdownloader.space/sitemaps/a.xml',
      'https://www.socialdownloader.space/sitemaps/b.xml',
    ])
  })
  it('a plain urlset (or nothing read) is the root alone', () => {
    expect(
      sitemapFeeds(ROOT, '<urlset><url><loc>https://a/</loc></url></urlset>')
    ).toEqual([ROOT])
    expect(sitemapFeeds(ROOT, null)).toEqual([ROOT])
  })
})

describe('googleJwt', () => {
  it('signs a webmasters-scoped RS256 assertion valid one hour', async () => {
    const [h, p, sig] = (await googleJwt(JSON.parse(SA), 1000)).split('.')
    expect(JSON.parse(atob(h))).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(
      JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')))
    ).toMatchObject({
      scope: 'https://www.googleapis.com/auth/webmasters',
      iat: 1000,
      exp: 4600,
    })
    expect(sig.length).toBeGreaterThan(300)
  })
})

describe('submitSitemaps', () => {
  it('PUTs each feed to GSC and POSTs each to Bing SubmitFeed', async () => {
    const f = fakeFetch(() => 200)
    const r = await submitSitemaps(
      { ...target, feeds: sitemapFeeds(ROOT, INDEX) },
      { GSC_SERVICE_ACCOUNT_JSON: SA, BING_API_KEY: 'k' },
      f.impl,
      () => {}
    )
    expect(r).toEqual({ gsc: 'ok', bing: 'ok' })
    const gsc = f.calls.filter((c) => c.url.includes('webmasters/v3'))
    expect(gsc.map((c) => c.init?.method)).toEqual(['PUT', 'PUT', 'PUT'])
    expect(gsc[2].url).toBe(
      'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Asocialdownloader.space/sitemaps/https%3A%2F%2Fwww.socialdownloader.space%2Fsitemaps%2Fb.xml'
    )
    const bing = f.calls.filter((c) => c.url.includes('SubmitFeed'))
    expect(bing).toHaveLength(3)
    expect(JSON.parse(String(bing[0].init?.body))).toEqual({
      siteUrl: 'https://socialdownloader.space',
      feedUrl: ROOT,
    })
  })

  it('skips an engine whose secret is missing, without a request', async () => {
    const f = fakeFetch(() => 200)
    expect(await submitSitemaps(target, {}, f.impl, () => {})).toEqual({
      gsc: 'skipped',
      bing: 'skipped',
    })
    expect(f.calls).toHaveLength(0)
  })

  it('a rejected submit is reported and warned, never thrown', async () => {
    const f = fakeFetch((u) => (u.includes('SubmitFeed') ? 400 : 403))
    const lines = []
    const r = await submitSitemaps(
      target,
      { GSC_SERVICE_ACCOUNT_JSON: SA, BING_API_KEY: 'k' },
      f.impl,
      (l) => lines.push(l)
    )
    expect(r).toEqual({ gsc: 'failed', bing: 'failed' })
    expect(lines.filter((l) => l.startsWith('::warning::'))).toHaveLength(2)
  })

  it('a bad service-account secret fails GSC and still submits to Bing', async () => {
    const f = fakeFetch(() => 200)
    const r = await submitSitemaps(
      target,
      { GSC_SERVICE_ACCOUNT_JSON: '{not json', BING_API_KEY: 'k' },
      f.impl,
      () => {}
    )
    expect(r).toEqual({ gsc: 'failed', bing: 'ok' })
  })
})
