import type { Format } from '@/lib/prefs'

export type FeatureCardId = 'video' | 'audio' | 'gallery' | 'zip'

/**
 * The format a home feature card switches to when tapped. People tapped these
 * cards and nothing happened (19 people on phones in two weeks, 14 Nov); now a
 * card is a shortcut into the paste bar, set up for what it names.
 *
 * Only the MP3 card picks audio. Galleries and the ZIP come out of a VIDEO
 * resolve: audio mode short-circuits every link to a soundtrack, so a gallery
 * card that picked audio would hand back an MP3 of a photo post.
 */
export function featureCardFormat(id: FeatureCardId): Format {
  return id === 'audio' ? 'audio' : 'video'
}

/** The paste bar's input. HomeLanding cards and the in-app hint both aim at it. */
export const PASTE_INPUT_ID = 'paste-link'
