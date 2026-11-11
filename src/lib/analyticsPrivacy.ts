/**
 * Keeps links out of the events PostHog builds on its own.
 *
 * The share target arrives as `/?url=…`, `/api/thumb` takes the source link as
 * a query parameter, and error messages quote URLs. What was downloaded is
 * recorded on purpose, as `content_url` on the download events (see
 * `contentLink`, and the privacy page, which must keep saying so). Every other
 * URL-shaped value is reduced here, in one pure function that `before_send`
 * runs over every event, so a token in a query string is never stored by
 * accident.
 */

/** Campaign tags say how somebody arrived, and carry nothing they pasted. */
const KEPT_QUERY_KEY = /^utm_[a-z]+$/

const URL_IN_TEXT = /\b(?:https?:\/\/|www\.)[^\s"'<>)]+/gi

/** `https://x/?url=…&utm_source=y` → `https://x/?utm_source=y`. */
export function scrubUrl(raw: string): string {
  const cut = raw.search(/[?#]/)
  if (cut === -1) return raw
  const path = raw.slice(0, cut)
  if (raw[cut] === '#') return path
  const kept = raw
    .slice(cut + 1)
    .split('#')[0]
    .split('&')
    .filter((pair) => KEPT_QUERY_KEY.test(pair.split('=')[0]))
  return kept.length ? `${path}?${kept.join('&')}` : path
}

/**
 * The query parameters that ARE the content on the sites that use them. All
 * others are share tokens and tracking ids, which can identify the sharer.
 */
const CONTENT_QUERY_KEYS = ['v', 'list']

/** The link as recorded on a download event: origin, path, content id. */
export function contentLink(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    const kept = new URLSearchParams()
    for (const key of CONTENT_QUERY_KEYS) {
      const value = url.searchParams.get(key)
      if (value) kept.set(key, value)
    }
    const query = kept.toString()
    return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`
  } catch {
    return undefined
  }
}

const SECOND_LEVEL = /^(?:co|com|org|net|gov|edu|ac|or|ne)$/

/**
 * The registrable domain of a link and nothing else: `dailymotion.com`, never
 * a path, query or subdomain. It says which SITE failed to resolve, which is
 * what a "generic" failure needs. ponytail: no public-suffix list, so only the
 * common `co.uk`-style second levels are kept whole; upgrade path is `tldts`.
 */
export function linkHost(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const text = raw.trim()
  try {
    const hostname = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`).hostname
      .toLowerCase()
      .replace(/\.$/, '')
    if (!hostname.includes('.') || /^[\d.]+$/.test(hostname) || hostname.includes(':')) {
      return undefined
    }
    const labels = hostname.split('.')
    const keep =
      labels.length > 2 && labels[labels.length - 1].length === 2 && SECOND_LEVEL.test(labels[labels.length - 2])
        ? 3
        : 2
    return labels.slice(-keep).join('.')
  } catch {
    return undefined
  }
}

/** Path words that name a route, never a person or a post. */
const ROUTE_WORDS = new Set([
  'post', 'posts', 't', 'p', 'reel', 'reels', 'video', 'videos', 'status', 'watch', 'share', 's',
  'shorts', 'comments', 'r', 'u', 'user', 'media', 'story', 'stories', 'clip', 'clips', 'spotlight',
  'pin', 'embed', 'photo', 'photos', 'i', 'v', 'tv', 'live', 'groups', 'permalink.php', 'watch.php',
  'video.php', 'story.php', 'channel', 'c', 'add', 'x', 'sv',
])

/**
 * The SHAPE of a link: its subdomain label, its route words and its query keys,
 * e.g. `www|/@*` + `/post/*?xmt`. Names become `@*` or `*`, numbers `#`, and no
 * query value is kept. It says which URL form a resolver missed without saying
 * whose post it was.
 */
export function linkShape(raw: string | null | undefined): string | undefined {
  const host = linkHost(raw)
  if (!raw || !host) return undefined
  const text = raw.trim()
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
    const hostname = u.hostname.toLowerCase().replace(/\.$/, '')
    const sub = hostname === host ? '' : hostname.slice(0, -host.length - 1)
    const path = u.pathname.split('/').filter(Boolean).map(shapeSegment).join('/')
    const keys = [...new Set(u.searchParams.keys())]
      .slice(0, 4)
      .map((k) => k.replace(/[^\w-]/g, '').slice(0, 12))
    const query = keys.length ? `?${keys.join('&')}` : ''
    return `${sub}|/${path}${query}`.slice(0, 120)
  } catch {
    return undefined
  }
}

function shapeSegment(seg: string): string {
  const lower = seg.toLowerCase()
  if (ROUTE_WORDS.has(lower)) return lower
  if (lower.startsWith('@') || lower.startsWith('%40')) return '@*'
  if (/^\d+$/.test(seg)) return '#'
  return '*'
}

/** Any URL quoted inside free text — an error message, usually — becomes `<url>`. */
export function scrubText(text: string): string {
  return text.replace(URL_IN_TEXT, '<url>')
}

const URL_PROPERTIES = [
  '$current_url',
  '$initial_current_url',
  '$session_entry_url',
  '$referrer',
  '$initial_referrer',
] as const

type Bag = Record<string, unknown>

function scrubUrlProperties(bag: Bag): void {
  for (const key of URL_PROPERTIES) {
    const value = bag[key]
    if (typeof value === 'string') bag[key] = scrubUrl(value)
  }
}

function scrubExceptionList(list: unknown): void {
  if (!Array.isArray(list)) return
  for (const item of list as { value?: unknown }[]) {
    if (typeof item?.value === 'string') item.value = scrubText(item.value)
  }
}

/** Mutates in place: this runs on every event, and the SDK owns the object. */
export function scrubEvent<
  T extends { properties?: Bag; $set?: Bag; $set_once?: Bag },
>(event: T): T {
  for (const bag of [event.properties, event.$set, event.$set_once]) {
    if (bag) scrubUrlProperties(bag)
  }
  const props = event.properties
  if (props) {
    scrubExceptionList(props.$exception_list)
    if (Array.isArray(props.$exception_values)) {
      props.$exception_values = props.$exception_values.map((value) =>
        typeof value === 'string' ? scrubText(value) : value,
      )
    }
  }
  return event
}
