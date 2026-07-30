import { handleImages } from '@/lib/apiRoutes'

// See src/lib/apiRoutes.ts — shared with the Cloudflare Worker entrypoint,
// which serves this path without initializing Next.
export async function POST(request: Request) {
  return handleImages(request)
}
