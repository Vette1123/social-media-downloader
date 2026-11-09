import { describe, expect, it } from 'vitest'
import { isMustPassStop, isProbePath } from './edge-health.mjs'

const BINGBOT =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36'
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

describe('isMustPassStop', () => {
  it('flags a crawler stopped on a real page', () => {
    expect(isMustPassStop({ userAgent: BINGBOT, clientRequestPath: '/es/tiktok-downloader' })).toBe(true)
    expect(isMustPassStop({ userAgent: GOOGLEBOT, clientRequestPath: '/' })).toBe(true)
  })

  // The 2026-11-02 weekly run failed on exactly these: scanners in crawler clothing.
  it.each(['/core/.env', '/document.php', '/env.bak', '/admin%2F.env', '/static/..;/..;/.env', '/DB.SQL'])(
    'ignores a crawler user agent probing %s',
    (path) => {
      expect(isMustPassStop({ userAgent: BINGBOT, clientRequestPath: path })).toBe(false)
    },
  )

  it('ignores a stopped client that is no crawler', () => {
    expect(isMustPassStop({ userAgent: 'python-requests/2.33.1', clientRequestPath: '/' })).toBe(false)
    expect(isMustPassStop({ clientRequestPath: '/' })).toBe(false)
  })
})

describe('isProbePath', () => {
  it('leaves every served path alone', () => {
    for (const path of ['/', '/pro', '/es/tiktok-downloader', '/sitemap.xml', '/robots.txt', '/f62bfbe4672c27f2ad3204b176eaab35.txt']) {
      expect(isProbePath(path)).toBe(false)
    }
  })
})
