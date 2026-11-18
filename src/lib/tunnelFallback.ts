/**
 * Whether a TikTok download that did not save should be retried from tikwm
 * before anything else.
 *
 * A TikTok result from the server is a Cobalt tunnel (`directIsAttachment`).
 * On 2026-11-18 the public instance answered `500` after ~6.5 s on 5 of 14 real
 * links, or stalled mid-file, while tikwm served every one of them. The old
 * path handed the dead tunnel to the browser's downloader and logged it as a
 * success, so the visitor got a failed or endless download and tapped again —
 * and the resolve cache gave them the same dead tunnel each time. See
 * lessons/2026-11-18-tiktok-tunnel-fallback.md.
 *
 * A tikwm result is a raw CDN URL (`directIsAttachment: false`), so this never
 * asks for tikwm twice.
 */
export function wantsTikwmFallback(
  outcome: 'saved' | 'too-big' | 'failed',
  meta: { platform?: string; directIsAttachment?: boolean } | null | undefined,
): boolean {
  return outcome !== 'saved' && meta?.platform === 'tiktok' && meta.directIsAttachment === true
}
