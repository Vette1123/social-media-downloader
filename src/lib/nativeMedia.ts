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
