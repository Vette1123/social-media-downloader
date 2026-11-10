/**
 * What kind of failure a resolve or a transfer was, as an enum a dashboard can
 * break down on. Pure, so the mapping is pinned by analyticsErrors.test.ts.
 *
 * The free text from extractors is not a breakdown: it varies per post. The
 * `code` is what groups, and only `upstream` and `server` are faults of ours.
 */
export type FailureCode =
  | 'private'
  | 'unavailable'
  | 'unsupported'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'upstream'
  | 'server'

const RULES: [RegExp, FailureCode][] = [
  [/failed to fetch|network ?error|network request failed|load failed|offline/i, 'network'],
  [/timed? ?out|aborterror|gateway/i, 'timeout'],
  [/rate.?limit|too many|\b429\b/i, 'rate_limited'],
  [/private|log ?in|logged[- ]in|signed[- ]in|sign in|age.?restricted|checkpoint/i, 'private'],
  [/not supported|unsupported|invalid url|valid url|not a (post|valid)/i, 'unsupported'],
  [/unavailable|not found|removed|deleted|\b404\b|region/i, 'unavailable'],
  // A host that refuses us: it blocks automated requests, a link expired (401/403/410),
  // or our proxy relays that the origin failed (502/504/530).
  [/blocks automated|\b(401|403|410|502|504|530)\b/i, 'unavailable'],
  [/\b5\d\d\b|internal|invalid response/i, 'server'],
]

export function failureCode(message: string | undefined): FailureCode {
  for (const [pattern, code] of RULES) {
    if (message && pattern.test(message)) return code
  }
  return 'upstream'
}

/** A failure with no fault of ours behind it: an event, not an Error Tracking issue. */
export function isExpectedFailure(code: FailureCode): boolean {
  return code !== 'upstream' && code !== 'server'
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
