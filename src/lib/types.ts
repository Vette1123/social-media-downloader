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
