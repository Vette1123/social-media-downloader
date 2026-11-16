# Full app audit: proxy XSS, false "saved" banners, races

## What
A full sweep: PostHog (errors, rage/dead clicks, extractor failure rates), the
WAF edge-health report, `pnpm shots` on 10 routes in 5 languages at 320 px, and a
read-only code review of the download flow. Fixed:

- `/api/image` served any upstream with the upstream's own content type. A
  link like `/api/image?url=<any page>` rendered that page's HTML and script
  as socialdownloader.space. It now answers 415 unless the upstream is an image
  (or octet-stream), and every image it serves carries `nosniff` plus a
  `sandbox` CSP, so an SVG cannot run script either. A live smoke check pins it.
- Gallery saves (one by one, and ZIP) reported "N saved" from the selection size,
  so expired links wrote nothing and still said every file landed. They now count
  real writes: none is the error banner, some is "Saved k of n".
- "Save both" started the MP3 after a cancelled or failed video.
- Enter, the paste chip and the Recent list could start a second resolve during
  a transfer; only the button was disabled.
- TikTok hedge: a fast `{success:false}` from the server (truthy) won the race
  against a browser answer about to succeed.
- The audio proxy skipped the http(s) check that image and video had.
- The gallery toggle and slide alt text were hard-coded English on every locale.
- A dismissed share sheet was tracked and shown as a failure.

## Mistakes
- The 7-day rage-click list looked alarming (129 people), but most targets
  were already fixed on 11-13/14. Re-querying the last 36 hours showed it quiet.
  Always narrow the window to after the last fix before acting on click data.
- The edge's `nosniff` header made the proxy look safe at a glance; nosniff
  does nothing when the declared type is already text/html.
- Git Bash rewrote `--routes /,/ar` into Windows paths: `MSYS_NO_PATHCONV=1`.

## What worked
- Probing the live endpoint with one curl turned "could be XSS" into a
  confirmed 200 text/html in seconds, so the fix shipped first, alone.
- Counting outcomes in a pure helper (`gallerySaveOutcome`) gave the UI fix a
  red-then-green test without a component harness.

## Rules
- A same-origin proxy of third-party bytes allow-lists the content type and
  sends a sandbox CSP. Never pass the upstream type through.
- A success message counts what actually happened, never what was asked for.
- A "busy" guard belongs in the shared handler, not on the one button.
