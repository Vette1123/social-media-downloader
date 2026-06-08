import { NextRequest, NextResponse } from 'next/server'
import { getMediaReferer } from '../../../lib/proxyHeaders'

// Instagram's scontent/fbcdn hosts omit CORS headers, so individual image
// downloads must be proxied same-origin through this route instead of fetched
// directly. getMediaReferer() adds the right Referer for hotlink-gated CDNs.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 },
      )
    }
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Invalid image URL format' },
        { status: 400 },
      )
    }

    const referer = getMediaReferer(imageUrl)
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    }
    if (referer) headers['Referer'] = referer

    const response = await fetch(imageUrl, { headers, redirect: 'follow' })
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status },
      )
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    }
    const contentLength = response.headers.get('content-length')
    if (contentLength) responseHeaders['Content-Length'] = contentLength

    return new NextResponse(response.body, {
      status: 200,
      headers: responseHeaders,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          'Failed to fetch image: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      },
      { status: 500 },
    )
  }
}
