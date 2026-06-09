import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { readdir, mkdir, copyFile, access } from 'node:fs/promises'

/**
 * yt-dlp integration. yt-dlp runs the extraction locally (from this process's
 * IP), which — unlike the public Cobalt/Piped instances on datacenter IPs —
 * YouTube does not bot-block when running from a residential connection. It is
 * therefore the most reliable YouTube source when the binary is available
 * (local dev / a self-hosted box). When it isn't (e.g. the Vercel serverless
 * runtime, where the binary isn't shipped), every call here fails gracefully so
 * the caller can fall back to the public extractors / embed.
 *
 * The binary is provided by the `youtube-dl-exec` dependency (downloaded on
 * install). Merging/transcoding uses the ffmpeg shipped by
 * `@ffmpeg-installer/ffmpeg`.
 */

type YtdlpFn = (url: string, flags: Record<string, unknown>) => Promise<unknown>

let cachedYtdlp: YtdlpFn | null = null

async function loadYtdlp(): Promise<YtdlpFn> {
  if (cachedYtdlp) return cachedYtdlp
  const mod = (await import('youtube-dl-exec')) as unknown as
    | YtdlpFn
    | { default: YtdlpFn }
  cachedYtdlp = (typeof mod === 'function' ? mod : mod.default) as YtdlpFn
  return cachedYtdlp
}

// Directory holding the ffmpeg binary, passed to yt-dlp so it can merge
// adaptive video+audio streams and transcode audio to mp3.
//
// Windows gotcha: yt-dlp (via youtube-dl-exec) builds a cmd.exe command string
// in which option *values* aren't quoted, so a `--ffmpeg-location` containing a
// space (this project lives under "C:\High Speed\...") silently breaks with
// "The system cannot find the path specified." When the bundled binary's path
// has a space, copy it into a space-free temp dir and point yt-dlp there.
// Resolved once and cached (null = not yet resolved).
let cachedFfmpegDir: string | undefined | null = null

async function ffmpegDir(): Promise<string | undefined> {
  if (cachedFfmpegDir !== null) return cachedFfmpegDir
  cachedFfmpegDir = undefined
  try {
    const mod = (await import('@ffmpeg-installer/ffmpeg')) as unknown as
      | { path?: string }
      | { default?: { path?: string } }
    const ffmpegPath =
      (mod as { path?: string }).path ??
      (mod as { default?: { path?: string } }).default?.path
    if (!ffmpegPath) return undefined

    if (!ffmpegPath.includes(' ')) {
      cachedFfmpegDir = path.dirname(ffmpegPath)
      return cachedFfmpegDir
    }

    const safeDir = path.join(os.tmpdir(), 'ttd-ffmpeg')
    const safeBin = path.join(safeDir, path.basename(ffmpegPath))
    // tmpdir is space-free on a normal install; bail out if it isn't.
    if (safeBin.includes(' ')) return undefined
    try {
      await access(safeBin)
    } catch {
      await mkdir(safeDir, { recursive: true })
      await copyFile(ffmpegPath, safeBin)
    }
    cachedFfmpegDir = safeDir
    return cachedFfmpegDir
  } catch {
    cachedFfmpegDir = undefined
    return undefined
  }
}

export interface YtInfo {
  title?: string
  uploader?: string
  duration?: number
  thumbnail?: string
}

/**
 * Resolve basic video info. Doubles as a fast availability probe: if it returns
 * a value, yt-dlp is present AND able to reach the video from here, so it's safe
 * to offer real downloads. Returns null on any failure (binary missing, video
 * blocked/unavailable, network error).
 */
export async function ytdlpInfo(url: string): Promise<YtInfo | null> {
  try {
    const ytdlp = await loadYtdlp()
    const info = (await ytdlp(url, {
      dumpSingleJson: true,
      noPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true,
      retries: 2,
    })) as Partial<YtInfo> | null
    if (!info || typeof info !== 'object' || !info.title) return null
    return {
      title: info.title,
      uploader: info.uploader,
      duration: info.duration,
      thumbnail: info.thumbnail,
    }
  } catch {
    return null
  }
}

export interface YtFile {
  file: string
  contentType: string
  ext: string
}

/**
 * Download a YouTube video to a temp file and return its path. For `video` it
 * merges the best ≤1080p video+audio into an mp4; for `audio` it extracts the
 * best audio track to mp3. The caller is responsible for streaming then
 * deleting the file. Throws on failure.
 */
export async function ytdlpDownload(
  url: string,
  kind: 'video' | 'audio',
): Promise<YtFile> {
  const ytdlp = await loadYtdlp()
  const dir = os.tmpdir()
  const stem = `yt-${randomUUID()}`
  const base = path.join(dir, stem)
  const ffDir = await ffmpegDir()

  const common: Record<string, unknown> = {
    output: `${base}.%(ext)s`,
    noPlaylist: true,
    noWarnings: true,
    noCheckCertificates: true,
    retries: 3,
    ...(ffDir ? { ffmpegLocation: ffDir } : {}),
  }

  if (kind === 'audio') {
    await ytdlp(url, {
      ...common,
      format: 'bestaudio/best',
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0,
    })
  } else {
    await ytdlp(url, {
      ...common,
      // Prefer mp4 video + m4a(AAC) audio so the streams copy into an mp4
      // container cleanly — opus/webm audio can't be copied into mp4 and makes
      // the merge fail. Fall back to a muxed mp4, then anything.
      // NOTE: avoid `<`/`>` here — youtube-dl-exec doesn't quote option values,
      // so cmd.exe on Windows would treat `height<=1080` as a redirection and
      // break. Cap the resolution with --format-sort (res:1080) instead.
      format: 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      // Prefer H.264 (avc1) FIRST, then cap resolution at 1080p. TikTok defaults
      // to h265/bytevc1, which no browser can play in a <video> tag (the stream
      // renders audio-only — the "shows as mp3" bug), and it often offers a
      // higher-res HEVC rendition than its H.264 one — so codec must outrank
      // resolution here, otherwise the bigger HEVC wins and playback breaks.
      // `vcodec:h264` only *prefers* H.264; with no H.264 rendition yt-dlp still
      // falls back to the best available.
      formatSort: 'vcodec:h264,res:1080',
      mergeOutputFormat: 'mp4',
    })
  }

  // yt-dlp names the output `${stem}.<ext>`; locate the produced file rather
  // than assume the extension (a merge may remux to mkv on odd codec combos).
  const produced = (await readdir(dir)).find((f) => f.startsWith(stem))
  if (!produced) throw new Error('yt-dlp produced no output file')

  const isAudio = kind === 'audio'
  return {
    file: path.join(dir, produced),
    contentType: isAudio ? 'audio/mpeg' : 'video/mp4',
    ext: isAudio ? 'mp3' : 'mp4',
  }
}
