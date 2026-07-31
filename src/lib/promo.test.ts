import { describe, expect, it } from 'vitest'
import { offerHref, selectOffer } from './promo'
import { OFFERS } from '../config/offers'
import type { Offer } from '@/config/offers'

const offer = (over: Partial<Offer> & { id: string }): Offer => ({
  headline: 'h',
  body: 'b',
  cta: 'c',
  href: 'https://example.com/x',
  weight: 1,
  platforms: 'all',
  placements: ['post-result'],
  ...over,
})

describe('selectOffer', () => {
  it('returns null when no offer matches the placement', () => {
    const offers = [offer({ id: 'a', placements: ['in-content'] })]
    expect(selectOffer(offers, { placement: 'post-result', seed: 0 })).toBeNull()
  })

  it('prefers a platform-specific offer over an all-platforms one', () => {
    const offers = [
      offer({ id: 'generic', platforms: 'all' }),
      offer({ id: 'tiktok-only', platforms: ['tiktok'] }),
    ]
    const picked = selectOffer(offers, {
      placement: 'post-result',
      platform: 'tiktok',
      seed: 0,
    })
    expect(picked?.id).toBe('tiktok-only')
  })

  it('falls back to all-platforms offers when nothing targets the platform', () => {
    const offers = [
      offer({ id: 'generic', platforms: 'all' }),
      offer({ id: 'tiktok-only', platforms: ['tiktok'] }),
    ]
    const picked = selectOffer(offers, {
      placement: 'post-result',
      platform: 'vimeo',
      seed: 0,
    })
    expect(picked?.id).toBe('generic')
  })

  it('is deterministic for a given seed', () => {
    const offers = [offer({ id: 'a' }), offer({ id: 'b' }), offer({ id: 'c' })]
    const opts = { placement: 'post-result' as const, seed: 7 }
    expect(selectOffer(offers, opts)?.id).toBe(selectOffer(offers, opts)?.id)
  })

  it('respects weight — a zero-weight offer is never picked', () => {
    const offers = [
      offer({ id: 'never', weight: 0 }),
      offer({ id: 'always', weight: 5 }),
    ]
    for (let seed = 0; seed < 50; seed++) {
      expect(selectOffer(offers, { placement: 'post-result', seed })?.id).toBe('always')
    }
  })

  it('ignores offers with a negative weight', () => {
    const offers = [offer({ id: 'bad', weight: -3 }), offer({ id: 'good', weight: 1 })]
    for (let seed = 0; seed < 20; seed++) {
      expect(selectOffer(offers, { placement: 'post-result', seed })?.id).toBe('good')
    }
  })
})

describe('offerHref', () => {
  it('appends a sub-id carrying placement and platform', () => {
    const href = offerHref(offer({ id: 'pcloud' }), 'post-result', 'tiktok')
    expect(href).toBe('https://example.com/x?subid=post-result_tiktok')
  })

  it('uses "none" for a missing platform', () => {
    const href = offerHref(offer({ id: 'pcloud' }), 'in-content')
    expect(href).toBe('https://example.com/x?subid=in-content_none')
  })

  it('preserves an existing query string', () => {
    const href = offerHref(
      offer({ id: 'x', href: 'https://example.com/x?ref=abc' }),
      'post-result',
      'youtube',
    )
    expect(href).toBe('https://example.com/x?ref=abc&subid=post-result_youtube')
  })

  it('inserts subid before a fragment rather than after it', () => {
    const href = offerHref(
      offer({ id: 'x', href: 'https://partner.com/deal#pricing' }),
      'post-result',
      'tiktok',
    )
    expect(href).toBe('https://partner.com/deal?subid=post-result_tiktok#pricing')
  })

  it('inserts subid before a fragment that follows an existing query', () => {
    const href = offerHref(
      offer({ id: 'x', href: 'https://partner.com/deal?a=1#pricing' }),
      'post-result',
      'tiktok',
    )
    expect(href).toBe('https://partner.com/deal?a=1&subid=post-result_tiktok#pricing')
  })
})

/**
 * The live catalogue, not a fixture. An offer only renders once its weight is
 * raised, and the weight and the href are edited at different moments — so the
 * failure this guards is real: a weight bumped while the href is still a
 * placeholder ships a dead link to every visitor who just downloaded something.
 */
describe('the shipped offer catalogue', () => {
  it('never gives a placeholder href a non-zero weight', () => {
    const live = OFFERS.filter((o) => o.weight > 0)
    const unfinished = live.filter((o) => o.href.startsWith('TEMPLATE_'))
    expect(unfinished.map((o) => o.id)).toEqual([])
  })

  it('only ships https destinations for offers that can render', () => {
    const live = OFFERS.filter((o) => o.weight > 0)
    const insecure = live.filter((o) => !o.href.startsWith('https://'))
    expect(insecure.map((o) => o.id)).toEqual([])
  })

  it('keeps offer ids unique, since the id is the React key and the subid', () => {
    const ids = OFFERS.map((o) => o.id)
    expect(ids).toEqual([...new Set(ids)])
  })
})
