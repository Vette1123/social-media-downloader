import { NextRequest, NextResponse } from 'next/server'

// Adds the right Referer for CDNs that gate hotlinking. Instagram's
// scontent/fbcdn hosts also omit CORS headers, so individual image downloads
// must be proxied same-origin through this route instead of fetched directly.
function getReferer(url: string): string {
  if (
    url.includes('tiktok.com') ||
    url.includes('tiktokcdn.com') ||
    url.includes('tiktokv.com')
  )
    return 'https://www.tiktok.com/'
  if (url.includes('tikwm.com')) return 'https://www.tikwm.com/'
  if (
    url.includes('twimg.com') ||
    url.includes('twitter.com') ||
    url.includes('x.com')
  )
    return 'https://x.com/'
  if (
    url.includes('cdninstagram.com') ||
    url.includes('fbcdn.net') ||
    url.includes('instagram.com')
  )
    return 'https://www.instagram.com/'
  return ''
}

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

    const referer = getReferer(imageUrl)
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
