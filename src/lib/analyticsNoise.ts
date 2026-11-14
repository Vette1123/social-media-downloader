/**
 * Which $exception events never reach Error Tracking.
 *
 * Ported from the sister project, where each rule was added because something
 * unfixable was burying real regressions: browser-extension DOM collisions,
 * cross-origin "Script error.", a bundle a deploy retired, a dropped connection.
 * A downloader attracts video-grabber extensions, so foreign stacks matter here.
 */

const NOISE_PATTERNS = [
  /Minified React error #418\b/i,
  /react\.dev\/errors\/418\b/i,
  /Hydration failed because the server rendered HTML/i,
  // Optionally behind the "[source]" prefix our own early-crash reporter adds.
  /^\s*(\[[\w:]+\]\s*)?Script error\.?\s*$/i,
  // iOS Safari, thrown with no stack and no frame of ours: native media controls
  // and a navigation cancelling a request. Nothing here to act on.
  /^\s*(DOMException: )?(NotSupportedError: The operation is not supported|AbortError: The operation was aborted)\.?\s*$/i,
  // A codec this browser cannot decode (Firefox and HEVC): native controls reject
  // play() with no stack. The <video> onError already tells the viewer.
  /^\s*(DOMException: )?NotSupportedError: The media resource indicated by the src attribute or assigned media provider object was not suitable\.?\s*$/i,
  /Failed to execute '(removeChild|insertBefore)' on 'Node'/i,
  // WebKit's NotFoundError; the early reporter sends the message without its type.
  /(NotFoundError: )?The object can not be found here/i,
  /The node to be removed is not a child of this node/i,
  /Child to insert before is not a child of this node/i,
  /ResizeObserver loop/i,
  /_internal_videoInjector/i,
  /\bstandardSelectors\b/,
  /Transition was skipped/i,
  // Wallet and page-translator scripts reading globals that are not ours.
  /window\.ethereum\b/,
  /reading 'M_ID'/,
  // Injected by a Safari extension or reader mode; nothing of ours defines it.
  /Can't find variable: EmptyRanges/i,
  // A tab that outlived a deploy, or a connection that dropped.
  /ChunkLoadError|Loading (CSS )?chunk \S+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/i,
]

// The static export ships every script of ours from /_next/.
const OWN_FRAME = /\/_next\//

interface ExceptionItem {
  type?: unknown
  value?: unknown
  stacktrace?: { frames?: unknown }
}

interface ExceptionEvent {
  properties?: Record<string, unknown>
}

function exceptionStrings(event: ExceptionEvent): string[] {
  const list = event.properties?.$exception_list
  if (!Array.isArray(list)) return []
  return (list as ExceptionItem[]).flatMap((item) =>
    [item?.value, item?.type].filter((v): v is string => typeof v === 'string'),
  )
}

/** A stack that names files, none of them ours: injected code threw, not the app. */
function isForeignException(event: ExceptionEvent): boolean {
  const list = event.properties?.$exception_list
  if (!Array.isArray(list)) return false
  let sawFrame = false
  for (const item of list as ExceptionItem[]) {
    const frames = item?.stacktrace?.frames
    if (!Array.isArray(frames)) continue
    for (const frame of frames as { filename?: unknown }[]) {
      if (typeof frame?.filename !== 'string') continue
      if (OWN_FRAME.test(frame.filename)) return false
      sawFrame = true
    }
  }
  return sawFrame
}

/**
 * The early-crash reporter wraps what it catches in an Error built at OUR call
 * site, so the stack PostHog receives is always ours and isForeignException can
 * never see the thrower. Decide here, from the original: a filename or stack that
 * names files, none of them under /_next/, is a wallet or extension script
 * (`window.ethereum.selectedAddress`, `M_ID`). An Error-shaped value that fails
 * `instanceof Error` was built in another JS realm, which none of our code runs
 * in (Chrome iOS's injected scripts: "Error: Na"). Nothing to go on is kept.
 */
export function isForeignEarlyError(filename: unknown, error: unknown): boolean {
  // No file, no stack, no Error: a cross-origin "Script error." is only its text,
  // and the same text rules that drop the exception drop the early report.
  if (NOISE_PATTERNS.some((pattern) => pattern.test(messageOf(error)))) return true
  const stack = stackOf(error)
  const file = typeof filename === 'string' ? filename : ''
  if (OWN_FRAME.test(file) || OWN_FRAME.test(stack)) return false
  const namesAFile = /\w+:\/\/|\.js\b/
  return namesAFile.test(file) || namesAFile.test(stack) || isOtherRealmError(error)
}

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' ? message : ''
}

function stackOf(error: unknown): string {
  const stack = (error as { stack?: unknown } | null)?.stack
  return typeof stack === 'string' ? stack : ''
}

function isOtherRealmError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || error instanceof Error) return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  return typeof name === 'string' && typeof message === 'string'
}

export function shouldDropException(event: ExceptionEvent): boolean {
  const noisy = exceptionStrings(event).some((text) =>
    NOISE_PATTERNS.some((pattern) => pattern.test(text)),
  )
  return noisy || isForeignException(event)
}

const FOCUSABLE = /^(input|textarea|select)(?![\w-])/i

/**
 * A $dead_click on a text field is a tap that focused it: focus changes nothing
 * PostHog watches, so it waits 1-3 s and calls the click dead. The link box drew 55
 * of the home page's "frustrated" people in a week (14 Nov) and buried the real
 * dead buttons. Rage clicks on it are kept: those are repeated taps, not one.
 */
export function isFocusDeadClick(event: {
  event?: string
  properties?: Record<string, unknown>
}): boolean {
  if (event.event !== '$dead_click') return false
  const elements = event.properties?.$elements
  const first = Array.isArray(elements) ? (elements[0] as { tag_name?: unknown } | undefined) : undefined
  if (typeof first?.tag_name === 'string') return FOCUSABLE.test(first.tag_name)
  const chain = event.properties?.$elements_chain
  return typeof chain === 'string' && FOCUSABLE.test(chain)
}
