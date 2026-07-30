import { handleImageProxy } from '@/lib/mediaProxy'

// The implementation lives in src/lib/mediaProxy.ts because the Cloudflare
// Worker entrypoint dispatches this same handler before Next's server is
// initialized — see the comment there for why that matters to the CPU budget.
// This wrapper is what serves the route under `next dev` and on Node hosts.
export async function GET(request: Request) {
  return handleImageProxy(request)
}
