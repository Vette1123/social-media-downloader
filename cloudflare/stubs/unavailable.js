/**
 * Stub for native-binary packages (youtube-dl-exec, fluent-ffmpeg,
 * @ffmpeg-installer/ffmpeg) on Cloudflare Workers.
 *
 * workerd has no subprocesses and no writable filesystem, so these packages can
 * never work there. They are aliased to this module in wrangler.jsonc so their
 * binaries and dependency trees stay out of the Worker bundle.
 *
 * Two shapes have to be tolerated:
 *
 *   1. Lazy use — src/lib/ytdlp.ts and src/lib/audioExtractor.ts load these via
 *      `await import(...)` inside a try/catch and fall back to the network
 *      extractors when it fails. Throwing on call reproduces exactly the
 *      "binary not available" path they were written for.
 *
 *   2. Module-scope configuration — /api/slideshow calls
 *      `ffmpeg.setFfmpegPath(...)` while the module is still initialising. That
 *      runs before any request handler can guard it, so the setters have to
 *      exist and do nothing rather than throw; otherwise importing the route at
 *      all would be a TypeError. The route's own capability check (see
 *      src/lib/nativeMedia.ts) rejects the request before any real work starts.
 */

const message =
  'Native binaries (yt-dlp / ffmpeg) are unavailable on Cloudflare Workers. ' +
  'Use the network extractors, or run this route on a host with a real ' +
  'filesystem and subprocess support.'

function unavailable() {
  throw new Error(message)
}

// Configuration setters are no-ops so module-scope wiring stays safe; anything
// that would actually run a binary throws.
unavailable.setFfmpegPath = () => {}
unavailable.setFfprobePath = () => {}
unavailable.setFlvtoolPath = () => {}
unavailable.ffprobe = unavailable
unavailable.path = ''

export default unavailable
export const path = ''
export const setFfmpegPath = () => {}
export const setFfprobePath = () => {}
export { unavailable as exec, unavailable as raw, unavailable as ffprobe }
