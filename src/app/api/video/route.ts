import { handleVideoProxy } from '@/lib/mediaProxy'

// See src/lib/mediaProxy.ts — shared with the Cloudflare Worker entrypoint,
// which serves this path without booting Next.
export async function GET(request: Request) {
  return handleVideoProxy(request)
}
