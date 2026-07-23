export interface ImageData {
  id: string
  url: string
  thumbnail: string
}

export interface VideoData {
  id: string
  title: string
  url: string
  thumbnail: string
  duration: number
  author: string
  description: string
  downloadUrl: string
  images?: ImageData[]
  isPhotoCarousel?: boolean
  musicUrl?: string
  musicTitle?: string
  musicAuthor?: string
  // True when downloadUrl / musicUrl is a Cobalt *tunnel* (Cobalt streams the
  // media through its own server with Content-Disposition: attachment, from any
  // IP). Such a URL can be handed straight to the browser for download instead
  // of being re-streamed through our /api/video|audio proxy — saving the
  // function's egress. Only set for `status:'tunnel'`, never for a raw CDN
  // `redirect` URL (those need our proxy for referer/content-type).
  tunnel?: boolean
  // Set when no downloadable stream could be extracted but the video can still
  // be played via an embedded player (used for YouTube, which bot-blocks free
  // extraction from datacenters). The UI shows the embed and hides the
  // download/audio buttons.
  embedUrl?: string
}

export interface ProcessedVideo {
  id: string
  url: string
  size?: number
  format: string
  quality?: string
  watermarkRemoved: boolean
}

export interface AudioData {
  id: string
  url: string
  size?: number
  format: string
  quality?: string
  duration: number
  title: string
  author: string
}

export interface DownloadResponse {
  success: boolean
  message: string
  downloadUrl?: string
  audioUrl?: string
  video?: ProcessedVideo
  audio?: AudioData
}
