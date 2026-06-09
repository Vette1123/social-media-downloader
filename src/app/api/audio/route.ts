import { NextRequest, NextResponse } from 'next/server'
import { getMediaReferer, resolveRangeResponse } from '../../../lib/proxyHeaders'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const videoUrl = searchParams.get('url')

    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: 'Video URL is required' },
        { status: 400 },
      )
    }

    console.log('Fetching audio from URL:', videoUrl)

    const referer = getMediaReferer(videoUrl)
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'video/webm,video/ogg,video/*;q=0.9,*/*;q=0.5',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'identity',
    }
    if (referer) headers['Referer'] = referer

    // Forward Range header for audio seeking when the client supports it
    const rangeHeader = request.headers.get('range')
    if (rangeHeader) headers['Range'] = rangeHeader

    const response = await fetch(videoUrl, { headers, redirect: 'follow' })

    if (!response.ok && response.status !== 206) {
      throw new Error(
        `Failed to fetch audio: ${response.status} ${response.statusText}`,
      )
    }

    // Cobalt tunnels reply 206 without a Content-Range, which browsers reject
    // for <audio> playback — normalize into a valid response.
    const ranged = await resolveRangeResponse(response, rangeHeader, () => {
      const { Range: _omit, ...noRange } = headers
      return fetch(videoUrl, { headers: noRange, redirect: 'follow' })
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `social-audio-${timestamp}.mp3`

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Accept-Ranges': 'bytes',
    }

    if (ranged.contentLength) responseHeaders['Content-Length'] = ranged.contentLength
    if (ranged.contentRange) responseHeaders['Content-Range'] = ranged.contentRange

    // Stream the body directly — works for real MP3 sources (slideshow music)
    // AND for MP4 video streams (browsers extract the audio track automatically).
    return new NextResponse(ranged.body, {
      status: ranged.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Audio extraction error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to extract audio' },
      { status: 500 },
    )
  }
}
