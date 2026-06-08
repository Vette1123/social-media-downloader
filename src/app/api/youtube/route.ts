import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'node:fs'
import { stat, rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { ytdlpDownload } from '../../../lib/ytdlp'

// yt-dlp shells out to a binary and writes to disk — must run on the Node
// runtime, not the edge. Long videos can take a while to download + merge.
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * On-demand YouTube downloader. yt-dlp extracts from this server's IP (reliable
 * when run locally / self-hosted, where YouTube doesn't bot-block residential
 * IPs), downloads to a temp file, streams it to the client, then deletes it.
 *
 *   /api/youtube?id=<videoId>&kind=video  → merged mp4
 *   /api/youtube?id=<videoId>&kind=audio  → extracted mp3
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') ?? ''
  const kind = searchParams.get('kind') === 'audio' ? 'audio' : 'video'

  // YouTube ids are 11 chars, but stay lenient within a safe charset to avoid
  // passing anything shell-significant into the extractor.
  if (!/^[A-Za-z0-9_-]{6,15}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid video id' }, { status: 400 })
  }

  const url = `https://www.youtube.com/watch?v=${id}`

  try {
    const { file, contentType, ext } = await ytdlpDownload(url, kind)
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
        'Content-Disposition': `attachment; filename="youtube-${id}.${ext}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/youtube] yt-dlp download failed:', error)
    return NextResponse.json(
      { error: 'Failed to download from YouTube via yt-dlp.' },
      { status: 500 },
    )
  }
}
