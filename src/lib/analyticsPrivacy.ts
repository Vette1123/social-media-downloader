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
