// What counts as "bad" in PostHog, as pure functions over query rows, so the
// thresholds are tested and the watcher script only does I/O.
//
// Every finding carries a stable `key`. The watcher writes it into the GitHub
// issue body and matches on it, so one problem is one issue across runs.
//
// Issues land in a PUBLIC repo: a finding holds hosts, id-free link shapes,
// codes and counts only. Never a message, a person, or a full link.

/** Hosts we have an extractor for. One of these under `generic` is a routing bug. */
export const SUPPORTED_HOSTS = [
  'facebook.com', 'fb.watch', 'instagram.com', 'tiktok.com', 'x.com', 'twitter.com',
  'youtube.com', 'youtu.be', 'threads.com', 'threads.net', 'pinterest.com', 'pin.it',
  'reddit.com', 'redd.it', 'snapchat.com', 'twitch.tv', 'vimeo.com', 'dailymotion.com',
  'dai.ly', 'linkedin.com', 'bsky.app', 'soundcloud.com',
  // Outbound-link wrappers: validator.unwrapRedirect peels these.
  'google.com', 'l.facebook.com', 'l.instagram.com',
]

/**
 * Codes that are not our bug: the platform's mood, the visitor's network, or a
 * verdict the extractor reached with evidence (a private or removed post).
 */
export const EXPECTED_CODES = ['rate_limited', 'network', 'canceled', 'private', 'unavailable']

/** Hosts the generic extractor serves on purpose (Telegram's embed page). */
export const GENERIC_HOSTS = ['t.me']

export const THRESHOLDS = {
  /** distinct people failing one platform+code+shape in the window */
  shapePeople: 4,
  /** distinct people failing a supported host routed to generic/unknown */
  misroutePeople: 2,
  /** platform failure share, with at least this many failing people */
  platformRate: 0.3,
  platformPeople: 6,
  /** distinct people hitting one error kind */
  errorPeople: 3,
  /** completed downloads in the last 24 h below this = something stopped working */
  silenceFloor: 15,
}

const isSupportedHost = (host) =>
  !!host && SUPPORTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))

const num = (v) => Number(v) || 0

/**
 * @param {object} data
 * @param {Array<{platform,code,host,shape,n,people}>} data.shapes  resolve_failed grouped
 * @param {Array<{platform,ok,bad,bad_people}>} data.platforms  bad = failures outside EXPECTED_CODES
 * @param {Array<{ev,kind,n,people}>} data.errors
 * @param {number} data.completed24h
 * @param {number} days  window length, for the wording
 */
export function findProblems({ shapes = [], platforms = [], errors = [], completed24h }, days = 3, t = THRESHOLDS) {
  const out = []

  for (const r of shapes) {
    const people = num(r.people)
    const routedAway = r.platform === 'generic' || r.platform === 'unknown'
    if (routedAway && isSupportedHost(r.host) && people >= t.misroutePeople) {
      out.push({
        key: `misroute:${r.host}:${r.shape}`,
        kind: 'misroute',
        title: `Misrouted link: ${r.host} ${r.shape} lands in ${r.platform}`,
        detail: `${people} people, ${num(r.n)} failed resolves in ${days} days. ${r.host} has its own extractor, so this shape should never reach \`${r.platform}\`. Check \`detectPlatform\` / \`extractLink\` in src/lib/validator.ts.`,
        people,
      })
      continue
    }
    if (routedAway && !GENERIC_HOSTS.includes(r.host)) continue
    if (EXPECTED_CODES.includes(r.code)) continue
    if (people >= t.shapePeople) {
      out.push({
        key: `shape:${r.platform}:${r.host}:${r.code}:${r.shape}`,
        kind: 'shape',
        title: `${r.platform} fails for ${r.host || '?'} ${r.shape} links (${r.code})`,
        detail: `${people} people, ${num(r.n)} failed resolves in ${days} days, code \`${r.code}\`, host ${r.host || '-'}. Reproduce with a real link of this shape through \`pnpm link:probe\` before changing the extractor.`,
        people,
      })
    }
  }

  for (const r of platforms) {
    const ok = num(r.ok)
    const bad = num(r.bad)
    const people = num(r.bad_people)
    if (r.platform === 'generic' || r.platform === 'unknown') continue
    const rate = bad / (ok + bad || 1)
    if (rate >= t.platformRate && people >= t.platformPeople) {
      out.push({
        key: `platform:${r.platform}`,
        kind: 'platform',
        title: `${r.platform} resolves fail ${Math.round(rate * 100)}%`,
        detail: `${bad} failed vs ${ok} succeeded in ${days} days, ${people} people affected. Run \`pnpm link:probe\` on a public ${r.platform} post and check the extractor chain.`,
        people,
      })
    }
  }

  for (const r of errors) {
    const people = num(r.people)
    if (people < t.errorPeople) continue
    out.push({
      key: `error:${r.kind}`,
      kind: 'error',
      title: `${r.ev} ${r.kind} hit ${people} people`,
      detail: `${num(r.n)} events from ${people} people in ${days} days. \`pnpm posthog:issues\` and \`pnpm posthog:query\` have the detail.`,
      people,
    })
  }

  if (completed24h !== undefined && num(completed24h) < t.silenceFloor) {
    out.push({
      key: 'silence:download_completed',
      kind: 'silence',
      title: `Only ${num(completed24h)} downloads completed in 24 h`,
      detail: `The floor is ${t.silenceFloor}. A build that fails to boot or a dead extractor sends nothing, so silence is the symptom. Check the latest deploy and \`pnpm cf:smoke\`.`,
      people: 0,
    })
  }

  return out.sort((a, b) => b.people - a.people)
}

const MARK = (key) => `<!-- posthog-watch:${key} -->`

export function issueBody(problem, { window, runUrl } = {}) {
  return [
    MARK(problem.key),
    problem.detail,
    '',
    `Window: ${window || 'last 3 days'}. Found by \`pnpm posthog:watch\`${runUrl ? ` ([run](${runUrl}))` : ''}.`,
    '',
    'Close as **completed** once fixed: it reopens only if the problem recurs after the close. Close as **not planned** if it is expected (a private post, an unsupported site): it stays closed.',
  ].join('\n')
}

/** The key an issue body was opened for, or null. */
export function issueKey(body) {
  return body?.match(/<!-- posthog-watch:(.+?) -->/)?.[1] ?? null
}

/**
 * What to do with one finding given the issue (if any) already filed for it.
 * A fixed issue reopens only when it was closed before the window began, so
 * every counted event happened after the fix; closed inside the window, the
 * fix may still be deploying, and a later run decides.
 * @returns {'create'|'update'|'reopen'|'skip'}
 */
export function decideAction(issue, windowStart) {
  if (!issue) return 'create'
  if (issue.state === 'open') return 'update'
  if (issue.state_reason === 'not_planned') return 'skip'
  return new Date(issue.closed_at) < windowStart ? 'reopen' : 'skip'
}
