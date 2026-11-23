/**
 * Which resolves are for supporters only, decided before any extractor runs.
 *
 * YouTube MP3 is the one today (2026-11-23, issue #88): YouTube put audio
 * behind a login, so the public resolvers fail it 38 times in 47. The owner
 * made it a supporter feature rather than let everyone wait for a failure.
 *
 * ponytail: a supporter resolve still goes through the same public resolvers,
 * so it fails the same way until a signed-in resolver exists (COBALT_API_URL
 * pointing at a Cobalt with a YouTube session). Configuring one fixes it for
 * supporters with no change here.
 */
import type { SupportedPlatform } from './validator'

export const YOUTUBE_MP3_SUPPORTER = 'MP3 from YouTube is a supporter feature.'

/** The refusal to send, or null when this resolve is open to the caller. */
export function supporterOnlyReason(
  platform: SupportedPlatform,
  mode: 'auto' | 'audio',
  isSupporter: boolean,
): string | null {
  if (isSupporter) return null
  if (platform === 'youtube' && mode === 'audio') return YOUTUBE_MP3_SUPPORTER
  return null
}

/**
 * A resolve body as this caller may see it.
 *
 * A YouTube *video* resolve carries the audio track too, and the card's MP3
 * button saves straight from it, so refusing audio-mode resolves alone left
 * MP3 one tap away. The stored body stays whole (both cache tiers are shared
 * and keyed on the link, not the caller); only the copy sent out is trimmed.
 */
export function bodyForCaller(
  body: string,
  platform: SupportedPlatform,
  isSupporter: boolean,
): string {
  if (isSupporter || platform !== 'youtube') return body
  const payload = JSON.parse(body) as {
    audioUrl?: string
    metadata?: { rawMusicUrl?: string; directAudioUrl?: string }
  }
  if (!payload.audioUrl && !payload.metadata?.rawMusicUrl && !payload.metadata?.directAudioUrl) {
    return body
  }
  delete payload.audioUrl
  if (payload.metadata) {
    delete payload.metadata.rawMusicUrl
    delete payload.metadata.directAudioUrl
  }
  return JSON.stringify(payload)
}
