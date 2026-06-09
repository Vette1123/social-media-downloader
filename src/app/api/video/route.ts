import { NextRequest, NextResponse } from 'next/server'
import { getMediaReferer, resolveRangeResponse } from '../../../lib/proxyHeaders'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const videoUrl = searchParams.get('url')

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 },
      )
    }

    if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Invalid video URL format' },
        { status: 400 },
      )
    }

    console.log('Proxying video from:', videoUrl)

    const referer = getMediaReferer(videoUrl)
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'identity',
    }
    if (referer) headers['Referer'] = referer

    // Forward Range header if present (enables seeking in the browser player)
    const rangeHeader = request.headers.get('range')
    if (rangeHeader) headers['Range'] = rangeHeader

    const response = await fetch(videoUrl, { headers, redirect: 'follow' })

    if (!response.ok && response.status !== 206) {
      console.error(
        'Failed to fetch video:',
        response.status,
        response.statusText,
      )
      return NextResponse.json(
        { error: `Failed to fetch video: ${response.status}` },
        { status: response.status },
      )
    }

    // Some upstreams (Cobalt tunnels) reply 206 without a Content-Range, which
    // browsers reject for <video> playback. Normalize into a valid response —
    // synthesizing the Content-Range, or falling back to a full 200.
    const ranged = await resolveRangeResponse(response, rangeHeader, () => {
      const { Range: _omit, ...noRange } = headers
      return fetch(videoUrl, { headers: noRange, redirect: 'follow' })
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `social-video-${timestamp}.mp4`

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Accept-Ranges': 'bytes',
    }

    if (ranged.contentLength) responseHeaders['Content-Length'] = ranged.contentLength
    if (ranged.contentRange) responseHeaders['Content-Range'] = ranged.contentRange

    // Stream the body directly — never buffer into memory
    return new NextResponse(ranged.body, {
      status: ranged.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Video proxy error:', error)
    return NextResponse.json(
      {
        error:
          'Failed to fetch video: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      },
      { status: 500 },
    )
  }
}
