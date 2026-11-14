/**
 * What kind of failure a resolve or a transfer was, as an enum a dashboard can
 * break down on. Pure, so the mapping is pinned by analyticsErrors.test.ts.
 *
 * The free text from extractors is not a breakdown: it varies per post. The
 * `code` is what groups, and only `upstream` and `server` are faults of ours.
 */
export type FailureCode =
  | 'private'
  | 'inconclusive'
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
  // A last-resort message that lists guesses ("may be private, age-restricted, or
  // unavailable") is not a diagnosis: it comes before `private` so the word inside it
  // does not decide the breakdown.
  [/\b(may|might) be (private|blocking)\b/i, 'inconclusive'],
  [/private|log ?in|logged[- ]in|signed[- ]in members|sign in|age.?restricted|checkpoint/i, 'private'],
  [/not supported|unsupported|cannot repackage|invalid url|valid url|not a (post|valid)/i, 'unsupported'],
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
  if (error instanceof Error) return error.message
  if (typeof error !== 'object' || error === null) return String(error)
  // A promise rejected with a plain object read as "[object Object]" on the
  // board (2026-11-12) and could never be traced. Its own message if it has
  // one, else its shape: constructor and key names, never values (privacy).
  const { message } = error as { message?: unknown }
  if (typeof message === 'string' && message) return message
  const kind = (error as object).constructor?.name || 'Object'
  const keys = Object.keys(error).slice(0, 6)
  return `[${kind}]${keys.length ? ` keys: ${keys.join(', ')}` : ' (no keys)'}`
}
