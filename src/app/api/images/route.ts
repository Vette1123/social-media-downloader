import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import JSZip from 'jszip'
import { slugify } from '@/lib/filename'

// Image URLs may arrive already wrapped in our own `/api/image?url=<raw>`
// display proxy (Instagram). Unwrap back to the raw CDN URL so the server can
// fetch it directly for ZIP bundling / individual re-proxying.
function toRawImageUrl(u: string): string {
  if (u.startsWith('/api/image')) {
    const marker = 'url='
    const i = u.indexOf(marker)
    if (i !== -1) {
      try {
        return decodeURIComponent(u.slice(i + marker.length))
      } catch {
        return u
      }
    }
  }
  return u
}

// Build the request headers for fetching a remote image, adding the right
// Referer for CDNs that gate hotlinking (Instagram's scontent/fbcdn hosts).
function imageHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
  if (
    url.includes('cdninstagram.com') ||
    url.includes('fbcdn.net') ||
    url.includes('instagram.com')
  ) {
    headers['Referer'] = 'https://www.instagram.com/'
  }
  return headers
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, title, asZip = false } = await request.json()

    // Slug used for ZIP entry names so extracted files stay recognisable.
    const titleSlug =
      (typeof title === 'string' && slugify(title, 40)) || 'image'

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      )
    }

    // If not downloading as ZIP, return proxied URLs for individual download.
    // Routing through /api/image keeps the fetch same-origin (so the browser
    // can read the blob) and lets the server attach the CDN Referer — both
    // required for hosts like Instagram that omit CORS headers.
    if (!asZip) {
      return NextResponse.json({
        success: true,
        images: imageUrls.map((url: string, index: number) => ({
          url: `/api/image?url=${encodeURIComponent(toRawImageUrl(url))}`,
          filename: `social-image-${index + 1}-${Date.now()}.jpg`,
        })),
      })
    }

    // If single image and asZip is true, still create ZIP
    if (imageUrls.length === 1 && asZip) {
      try {
        const src = toRawImageUrl(imageUrls[0])
        const response = await axios.get(src, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: imageHeaders(src),
        })

        const zip = new JSZip()
        zip.file(`${titleSlug}.jpg`, response.data)
        const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
        const zipName = title
          ? `${title.replace(/[^a-zA-Z0-9]/g, '_')}_images.zip`
          : `tiktok-images-${Date.now()}.zip`

        return new NextResponse(zipBuffer, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${zipName}"`,
          },
        })
      } catch (error) {
        console.error('Error downloading single image:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to download image' },
          { status: 500 }
        )
      }
    }

    // Multiple images - create ZIP
    const zip = new JSZip()
    const pad = Math.max(2, String(imageUrls.length).length)
    const downloadPromises = imageUrls.map(
      async (url: string, index: number) => {
        const src = toRawImageUrl(url)
        try {
          const response = await axios.get(src, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: imageHeaders(src),
          })

          const filename = `${titleSlug}_${String(index + 1).padStart(pad, '0')}.jpg`
          zip.file(filename, response.data)
        } catch (error) {
          console.error(`Error downloading image ${index + 1}:`, error)
          // Add a placeholder for failed downloads
          zip.file(`image-${index + 1}-failed.txt`, `Failed to download: ${src}`)
        }
      }
    )

    await Promise.all(downloadPromises)

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
    const zipName = title
      ? `${title.replace(/[^a-zA-Z0-9]/g, '_')}_images.zip`
      : `tiktok-images-${Date.now()}.zip`

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
      },
    })
  } catch (error) {
    console.error('Error creating image archive:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process images' },
      { status: 500 }
    )
  }
}
