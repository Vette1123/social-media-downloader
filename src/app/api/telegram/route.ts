import { handleTelegram, telegramHealth } from '@/lib/apiRoutes'

// The implementations live in src/lib/telegram.ts, shared with the Cloudflare
// Worker entrypoint, which serves these paths without initializing Next - see
// that file and the API_ROUTES entries for why the CPU budget requires it.
export async function POST(request: Request) {
  return handleTelegram(request)
}

export async function GET() {
  return Response.json(telegramHealth())
}
