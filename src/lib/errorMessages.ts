// Turn a raw backend/extractor error string into a clear, specific, human
// message for the results banner. The backend already returns fairly specific
// text; this classifier normalises the common failure modes into a consistent
// voice and adds an actionable hint, without swallowing genuinely novel errors.

import { dKnown, dn, speaksEnglish } from '@/lib/i18nDeep'

const GENERIC_HINT = dn('Something went wrong resolving the media. Try again in a moment.')

/**
 * Whether a retry can help: `yes` for a condition that passes (rate limit, a
 * dropped connection), `no` for a link that cannot work as pasted, `once` for
 * everything else — worth one more try, never fifty.
 */
export type RetryAdvice = 'yes' | 'once' | 'no'

export interface FriendlyError {
  /** Short headline shown in bold. */
  title: string
  /** One-line actionable hint. */
  hint: string
  retry: RetryAdvice
}

const PRIVATE = /private|login|log in|logged[- ]in|sign[- ]in|authenticat/i
const AGE = /age[- ]restrict|18\+|nsfw|sensitive/i
const REGION = /region|geo[- ]?block|not available in your|country/i
const GONE = /deleted|removed|unavailable|not found|no longer|404/i
const UNSUPPORTED = /unsupported|invalid url|couldn'?t? (parse|recogni)|not a valid/i
const RATE = /rate[- ]?limit|too many|429|blocking requests|blocked/i
// "Failed to fetch" (Chrome/Firefox) and "Load failed" (Safari) are what a
// dropped connection actually reads as at the call site, and neither contains
// the word "network" — so this used to fall through to the generic branch and
// show somebody the browser's own internal phrasing.
const NETWORK =
  /network|timeout|timed out|econn|fetch failed|failed to fetch|load failed|socket/i
const STORY = /story|stories|highlight/i
// The extractors' last resort lists GUESSES: "may be private, age-restricted,
// or unavailable". Read word by word, that made every X failure "Age-restricted"
// and every unknown site "private" (14 Nov), and people retried a post they had
// been told the wrong thing about. Same pattern as analyticsErrors' `inconclusive`.
const INCONCLUSIVE = /\b(may|might) be (private|blocking)\b/i

const REPEAT_HINT = dn(
  'Same result twice — retrying won’t change it. Try another post, or check this one opens in a private browser window.',
)

export interface ErrorContext {
  /**
   * False only when the browser is certain there is no connection.
   *
   * One-directional on purpose: `navigator.onLine === false` means definitely
   * offline, while `true` only means an interface is up — a captive portal or a
   * dead uplink still reports it. So this answers "offline" and never "online".
   */
  online?: boolean
}

/**
 * Map a raw error to a friendly headline + hint. Falls back to the raw text
 * (trimmed) as the hint so nothing is ever hidden from the user.
 */
export function friendlyError(
  raw: string | undefined,
  url?: string,
  context: ErrorContext = {},
): FriendlyError {
  const text = (raw || '').trim()
  const looksInstagramStory = !!url && /instagram\.com\/(stories|s)\//i.test(url)

  // First, because it outranks everything the text could say: with no
  // connection the request never reached us, so nothing about the post is
  // known — and telling somebody their link might be private when their wifi
  // is off sends them to check the wrong thing.
  if (context.online === false) {
    return {
      title: 'You are offline',
      hint: 'This link needs a connection to resolve. Reconnect and try again — nothing about the post is wrong.',
      retry: 'yes',
    }
  }

  if (looksInstagramStory || (STORY.test(text) && PRIVATE.test(text))) {
    return {
      title: 'Stories need a logged-in session',
      hint: 'Instagram only serves stories & highlights to signed-in accounts, so they can’t be fetched anonymously here.',
      retry: 'no',
    }
  }
  if (INCONCLUSIVE.test(text)) {
    return {
      title: 'We couldn’t download this one',
      hint: 'The site didn’t say why. Posts that only open for signed-in accounts fail this way. Check it opens in a private browser window.',
      retry: 'once',
    }
  }
  // The two passing conditions come before the post-level guesses: their text
  // often also says "login" or "unavailable", and only these are worth a wait.
  if (RATE.test(text)) {
    return {
      title: 'Temporarily rate-limited',
      hint: 'The site is limiting how fast we can read posts. Your link is fine — try again in a few minutes.',
      retry: 'yes',
    }
  }
  if (NETWORK.test(text)) {
    return {
      title: 'Network hiccup',
      hint: 'The request timed out. Check your connection and try again.',
      retry: 'yes',
    }
  }
  if (AGE.test(text)) {
    return {
      title: 'Age-restricted content',
      hint: 'The platform gates this behind an age check, so it can’t be resolved without a logged-in account.',
      retry: 'once',
    }
  }
  if (PRIVATE.test(text)) {
    return {
      title: 'This post is private or login-only',
      hint: 'Only public posts can be downloaded. Make sure the account and post are public, then try again.',
      retry: 'once',
    }
  }
  if (REGION.test(text)) {
    return {
      title: 'Region-locked content',
      hint: 'The source restricts this by country and blocks our server’s region.',
      retry: 'once',
    }
  }
  if (GONE.test(text)) {
    return {
      title: 'Post unavailable',
      hint: 'It may have been deleted or made private. Double-check the link opens in a browser.',
      retry: 'once',
    }
  }
  if (UNSUPPORTED.test(text)) {
    return {
      title: 'Unsupported or malformed link',
      hint: 'Paste a full post URL (e.g. the share link) from a supported platform.',
      retry: 'no',
    }
  }
  return {
    title: 'Couldn’t process this link',
    hint: text || GENERIC_HINT,
    retry: 'once',
  }
}

/**
 * Whether to offer "Try again" after `repeats` identical failures of one link.
 * A passing condition always; a dead-end never; anything else only the first time.
 */
export function failureRetry(
  raw: string | undefined,
  url: string | undefined,
  context: ErrorContext = {},
  repeats = 1,
): boolean {
  const { retry } = friendlyError(raw, url, context)
  if (retry === 'yes') return true
  return retry === 'once' && repeats < 2
}

/**
 * The banner line in the page's language. Server text has no translation, so
 * where English would show it raw, a translated page says the general sentence.
 * From the second identical failure, the hint says retrying won't help.
 */
export function failureLine(
  raw: string | undefined,
  url?: string,
  context: ErrorContext = {},
  repeats = 1,
): string {
  const { title, hint, retry } = friendlyError(raw, url, context)
  if (retry === 'once' && repeats >= 2) return `${dKnown(title)} — ${dKnown(REPEAT_HINT)}`
  const known = dKnown(hint)
  const shown = known === hint && !speaksEnglish() ? dKnown(GENERIC_HINT) : known
  return `${dKnown(title)} — ${shown}`
}

/** For a short slot: the server's words in English, the headline elsewhere. */
export function failureTitle(raw: string): string {
  return speaksEnglish() ? raw : dKnown(friendlyError(raw).title)
}
