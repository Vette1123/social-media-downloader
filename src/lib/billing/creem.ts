/**
 * The two things every outbound Creem call needs, in one place.
 *
 * Both the portal and the reconcile repair talk to the same API with the same
 * key, so the base URL and the auth header live here rather than being spelled
 * out at each call site — a renamed header fixed in one place cannot come back
 * in the other.
 */

const PRODUCTION = 'https://api.creem.io/v1'
const TEST = 'https://test-api.creem.io/v1'

/**
 * Which environment a key belongs to, decided by the key itself.
 *
 * Creem issues `creem_test_…` for test mode and routes it to a separate host,
 * and a test key sent to production is rejected rather than politely ignored.
 * Deriving the host from the key means switching environments is one secret to
 * change, with no second setting to forget — and no way to point a live key at
 * the sandbox by accident.
 */
export function creemApi(apiKey: string): string {
  return apiKey.startsWith('creem_test_') ? TEST : PRODUCTION
}

/** Creem authenticates with a bare key header, not a Bearer token. */
export function creemHeaders(apiKey: string): Record<string, string> {
  return { 'x-api-key': apiKey, Accept: 'application/json' }
}
