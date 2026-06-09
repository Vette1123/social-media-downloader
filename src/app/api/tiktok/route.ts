import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'node:fs'
import { stat, rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { ytdlpDownload } from '../../../lib/ytdlp'
import { parseVideoId } from '../../../lib/validator'

// yt-dlp shells out to a binary and writes to disk — must run on the Node
// runtime, not the edge.
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * On-demand TikTok downloader. The public scraper services (tikwm, snaptik,
 * ssstik) have all gone behind Cloudflare / changed formats / require rotating
 * tokens, so when they fail this is the reliable fallback: yt-dlp extracts the
 * video from this server's IP, downloads it to a temp file, streams it to the
 * client, then deletes it.
 *
 * Unlike the /api/video proxy, we can't just hand the browser TikTok's CDN URL:
 * those URLs are signed against the session/IP that negotiated them and 403 when
 * replayed from anywhere else. Letting yt-dlp do the fetch sidesteps that.
 *
 *   /api/tiktok?url=<tiktok url>&kind=video  → H.264 mp4 (browser-playable)
 *   /api/tiktok?url=<tiktok url>&kind=audio  → extracted mp3
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get('url') ?? ''
  const kind = searchParams.get('kind') === 'audio' ? 'audio' : 'video'

  // Validate + sanitize before shelling out. On Windows installs whose path
  // contains a space, youtube-dl-exec runs the binary through a shell, so the
  // URL must not be able to smuggle shell metacharacters. We rebuild a canonical
  // URL from a validated TikTok host + a path restricted to a safe charset, and
  // drop the query entirely (TikTok's `?_t=…&_r=…` are just tracking params;
  // yt-dlp resolves vt./vm. short links on its own).
  let canonical: string
  try {
    const parsed = new URL(rawUrl)
    const host = parsed.hostname.toLowerCase()
    const isTikTok = host === 'tiktok.com' || host.endsWith('.tiktok.com')
    if (!isTikTok || !/^[A-Za-z0-9@._/-]+$/.test(parsed.pathname)) {
      return NextResponse.json({ error: 'Invalid TikTok URL' }, { status: 400 })
    }
    canonical = `https://${host}${parsed.pathname}`
  } catch {
    return NextResponse.json({ error: 'Invalid TikTok URL' }, { status: 400 })
  }

  const id = parseVideoId(rawUrl) || 'video'

  try {
    const { file, contentType, ext } = await ytdlpDownload(canonical, kind)
    const { size } = await stat(file)

    const nodeStream = createReadStream(file)
    const cleanup = () => {
      rm(file, { force: true }).catch(() => {})
    }
    nodeStream.on('close', cleanup)
    nodeStream.on('error', cleanup)

    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(size),
        'Content-Disposition': `attachment; filename="tiktok-${id}.${ext}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/tiktok] yt-dlp download failed:', error)
    return NextResponse.json(
      { error: 'Failed to download from TikTok via yt-dlp.' },
      { status: 500 },
    )
  }
}
