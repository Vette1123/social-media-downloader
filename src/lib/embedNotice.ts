/**
 * What a result card must say up front when its video can only be played.
 *
 * YouTube falls back to an embed when video extraction is bot-blocked. The
 * card used to explain that only inside the preview, which is collapsed by
 * default, so the card read as a success with nothing to save. PostHog, 30 Oct
 * to 14 Nov: 242 people resolved a YouTube link as `content_type=embed` and 4
 * completed a download. The notice now sits on the card itself.
 *
 * `null` when there is nothing to warn about: no embed, or a video stream that
 * the download buttons already offer.
 */
export type EmbedNotice = 'audio_only' | 'play_only'

export function embedNotice(subject: {
  hasEmbed: boolean
  hasVideo: boolean
  hasAudio: boolean
}): EmbedNotice | null {
  if (!subject.hasEmbed || subject.hasVideo) return null
  return subject.hasAudio ? 'audio_only' : 'play_only'
}
