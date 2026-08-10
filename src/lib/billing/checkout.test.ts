import { describe, expect, it } from 'vitest'
import { SESSION_COOKIE } from '../auth/cookies'
import { handleCheckout } from './checkout'

/**
 * This route used to mint Creem checkouts, and its tests pinned the two
 * disasters that made it worth having: a test-keyed deployment charging a real
 * card, and a purchase leaving no trace in our own database. Neither is
 * representable now — there is no checkout — so what is pinned instead is the
 * one property that still matters.
 *
 * A visitor who follows an old "Get Pro" link must land on a page. This route
 * is reached by clicking, so answering with JSON, a 404, or anything that needs
 * a session would strand someone whose only mistake was having a stale tab
 * open. It must redirect, unconditionally, without reading anything.
 */

function checkoutRequest(query = '?variant=annual', withSession = false): Request {
  return new Request(`https://www.socialdownloader.space/api/billing/checkout${query}`, {
    headers: withSession
      ? { Cookie: `${SESSION_COOKIE}=raw-session-value`, 'Sec-Fetch-Mode': 'navigate' }
      : { 'Sec-Fetch-Mode': 'navigate' },
  })
}

describe('handleCheckout', () => {
  it('redirects to the support page', async () => {
    const response = await handleCheckout(checkoutRequest())
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/pro')
  })

  it('never sends anyone to a payment provider', async () => {
    const response = await handleCheckout(checkoutRequest())
    expect(response.headers.get('Location')).not.toContain('creem')
    expect(response.headers.get('Location')).not.toMatch(/^https?:/)
  })

  // The old route refused a signed-out click with a 401, because a purchase
  // with no user id could not be repaired. Nothing is bought here, so both a
  // signed-in and a signed-out visitor get the same page.
  it.each([
    ['signed out', false],
    ['signed in', true],
  ])('redirects a %s visitor identically', async (_label, withSession) => {
    const response = await handleCheckout(checkoutRequest('', withSession))
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/pro')
  })

  // An unknown or absent variant used to be a 400. It is now indistinguishable
  // from any other click, which is the point: there are no variants left to be
  // wrong about.
  it('ignores the variant entirely', async () => {
    const response = await handleCheckout(checkoutRequest('?variant=nonsense'))
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/pro')
  })

  it('is not cached, so the destination can change', async () => {
    const response = await handleCheckout(checkoutRequest())
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
