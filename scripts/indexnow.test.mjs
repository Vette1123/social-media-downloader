import { expect, it } from 'vitest'
import { changedUrls } from './indexnow.mjs'

const sitemap = (entries) =>
  `<urlset>${entries
    .map(
      ([loc, lastmod]) =>
        `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><image:image><image:loc>${loc}/og</image:loc></image:image></url>`,
    )
    .join('')}</urlset>`

const OLD = '2026-10-30T00:00:00.000Z'
const NEW = '2026-10-31T00:00:00.000Z'

it('sends nothing when the deploy moved no page', () => {
  const xml = sitemap([['https://x.test/a', OLD]])
  expect(changedUrls(xml, xml)).toEqual([])
})

it('sends only the page whose lastmod moved', () => {
  const before = sitemap([['https://x.test/a', OLD], ['https://x.test/b', OLD]])
  const after = sitemap([['https://x.test/a', OLD], ['https://x.test/b', NEW]])
  expect(changedUrls(before, after)).toEqual(['https://x.test/b'])
})

it('sends a new page, and a removed one so engines drop it', () => {
  const before = sitemap([['https://x.test/gone', OLD]])
  const after = sitemap([['https://x.test/new', OLD]])
  expect(changedUrls(before, after).sort()).toEqual([
    'https://x.test/gone',
    'https://x.test/new',
  ])
})

it('treats a baseline with no URLs as unusable, not as "everything is new"', () => {
  // A challenge page saved as the snapshot must fail loudly, so the caller can
  // say why it fell back rather than quietly claiming 80 pages are new.
  expect(changedUrls('<html>Just a moment...</html>', sitemap([['https://x.test/a', OLD]]))).toBeNull()
})
