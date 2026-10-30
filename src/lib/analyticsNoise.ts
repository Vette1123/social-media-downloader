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
  /^\s*Script error\.?\s*$/i,
  /Failed to execute '(removeChild|insertBefore)' on 'Node'/i,
  /NotFoundError: The object can not be found here/i,
  /The node to be removed is not a child of this node/i,
  /Child to insert before is not a child of this node/i,
  /ResizeObserver loop/i,
  /_internal_videoInjector/i,
  /\bstandardSelectors\b/,
  /Transition was skipped/i,
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

export function shouldDropException(event: ExceptionEvent): boolean {
  const noisy = exceptionStrings(event).some((text) =>
    NOISE_PATTERNS.some((pattern) => pattern.test(text)),
  )
  return noisy || isForeignException(event)
}
