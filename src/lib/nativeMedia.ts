/**
 * Whether this runtime can execute the native media binaries (yt-dlp, ffmpeg).
 *
 * They need a subprocess and a writable filesystem. That holds locally and on a
 * self-hosted box, but not on Cloudflare Workers (workerd has neither) and not
 * on Vercel's serverless runtime (the binaries aren't shipped there). The routes
 * that depend on them already degrade gracefully, but "gracefully" still meant
 * doing the expensive part first — /api/slideshow downloads every frame into
 * memory before it ever reaches ffmpeg. Checking up front turns a doomed request
 * into an immediate, honest answer instead of wasted bandwidth and CPU.
 *
 * Read lazily rather than captured at module scope: the adapter populates
 * process.env from the Worker's bindings, and this keeps the value correct no
 * matter when the module happens to be initialised.
 */
export function nativeMediaAvailable(): boolean {
  return process.env.DEPLOY_TARGET !== 'cloudflare'
}

/**
 * Whether this runtime can afford to fetch a full social-platform page and scan
 * it for an embedded media URL.
 *
 * On Cloudflare it cannot, for two independent reasons:
 *
 *   - CPU. A TikTok video page ships megabytes of markup; locating the state
 *     blob in it and unescaping the URL is the single most expensive thing the
 *     extractor does. Measured on the deployed Worker, a TikTok resolve that
 *     reached these strategies cost 8-13 ms of CPU against a 10 ms budget,
 *     while the same request with them skipped costs low single digits.
 *
 *   - It cannot work anyway. Every one of these strategies depends on the
 *     origin serving real markup to the caller, and TikTok, Facebook and the
 *     public scraper front-ends all answer a Cloudflare egress IP with a bot
 *     wall. Verified against the deployment: with all six TikTok strategies
 *     enabled, every one of them failed, and the request still spent ~3.8 s of
 *     wall time and the whole CPU budget getting there.
 *
 * So this is not a capability being traded away for speed — it is dead weight
 * that was both the most expensive path and a guaranteed miss. The extraction
 * that does work from a datacenter IP is Cobalt, or the self-hosted resolver
 * discovered through Upstash (see deploy/resolver/OPERATIONS.md), and both stay
 * enabled everywhere.
 *
 * Locally and on any host with a residential or unblocked IP, the scrapers stay
 * on and nothing changes.
 */
export function htmlScrapingAvailable(): boolean {
  return process.env.DEPLOY_TARGET !== 'cloudflare'
}

/**
 * Whether the two *other* free relays in pageScrape.ts are worth a subrequest
 * here — the archive and the CORS proxy. The reader is not gated: see below.
 *
 * They are the last resort for a page that answered us with a bot wall: read
 * it through somebody else's address instead. Measured from the deployed
 * Worker on 2026-09-22 against a host that walls us, the Internet Archive and
 * the allorigins CORS proxy still refuse Cloudflare egress (403/429 in ~250 ms
 * each) while answering the same request from a residential connection, so on
 * Workers they are two doomed subrequests. The reader (r.jina.ai), which an
 * older measurement had refusing too, now answers that egress with the real
 * markup and is always tried regardless of this gate.
 *
 * A configured SCRAPE_UNLOCKER_URL is a different thing — an endpoint the
 * operator chose, on egress that is not ours — and is still tried everywhere.
 *
 * Off Cloudflare (local, a self-hosted box, any residential or unblocked IP)
 * the relays work and stay on.
 */
export function secondaryRelaysUsable(): boolean {
  return process.env.DEPLOY_TARGET !== 'cloudflare'
}

/**
 * 501 for the routes that cannot run here. Not a 500: nothing failed, the
 * capability is simply absent on this host, and the client already treats a
 * non-OK response from these routes as "use the fallback path".
 *
 * A plain `Response` rather than `NextResponse` so the Cloudflare Worker
 * entrypoint can return it directly. On Cloudflare these three routes are
 * always unavailable, and answering from the Worker avoids initializing Next
 * just to say no — which measured at 92 ms of CPU against a 10 ms budget.
 * App Router route handlers accept a plain Response, so the Next path is
 * unaffected.
 */
export function nativeMediaUnavailable(feature: string): Response {
  return Response.json(
    {
      success: false,
      error: `${feature} is unavailable on this deployment. It needs ffmpeg/yt-dlp, which require a host with subprocess and filesystem support.`,
    },
    { status: 501 },
  )
}
