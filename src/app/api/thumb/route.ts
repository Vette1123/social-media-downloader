import { NextRequest, NextResponse } from 'next/server'
import { getMediaReferer } from '../../../lib/proxyHeaders'

// Server-side thumbnail snapshot for the Recent list. The client normally
// captures a compact 96px JPEG on a canvas (see snapshotImage in
// DownloaderApp), which persists the pixels so a Recent thumbnail never goes
// blank when a signed CDN URL later expires. This route is the FALLBACK for
// when the canvas path fails (decode error, or an old browser that taints the
// canvas): it fetches the image server-side — with the right Referer for
// hotlink-gated CDNs, which the browser can't send — and returns it as a
// self-contained data URL the client can store the same way.
//
// We cap the payload so a huge source image can't bloat localStorage; oversized
// or non-image responses return { dataUrl: null } and the client falls back to
// a branded platform tile.
const MAX_BYTES = 300_000

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      return NextResponse.json({ dataUrl: null }, { status: 200 })
    }

    const referer = getMediaReferer(imageUrl)
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    }
    if (referer) headers['Referer'] = referer

    const response = await fetch(imageUrl, { headers, redirect: 'follow' })
    if (!response.ok) return NextResponse.json({ dataUrl: null })

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ dataUrl: null })
    }
    const declared = Number(response.headers.get('content-length')) || 0
    if (declared > MAX_BYTES) return NextResponse.json({ dataUrl: null })

    const buf = Buffer.from(await response.arrayBuffer())
    // Re-check after download — some CDNs omit content-length.
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      return NextResponse.json({ dataUrl: null })
    }

    const dataUrl = `data:${contentType};base64,${buf.toString('base64')}`
    return NextResponse.json(
      { dataUrl },
      { headers: { 'Cache-Control': 'public, max-age=86400' } },
    )
  } catch {
    return NextResponse.json({ dataUrl: null })
  }
}
