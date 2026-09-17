# The Twitter API request claimed to be Chrome

## What

The reported Twitter post returned 422 from production. Its VX API response contained a video when requested by a normal API client, but the application's Chrome user-agent received 403 HTML. The Twitter API request now identifies itself as `SocialMediaDownloader/1.0`. Other extractors keep their existing headers. No cookies, authentication changes, or new fallback services were added.

## Mistakes

The first successful metadata request used different headers from the application, so it did not reproduce the failure. Matching the application's headers exposed it. Extra build and startup comparisons were unnecessary for a one-header change; the startup script also read an existing bundle, so those measurements were discarded.

## What worked

Changing only the user-agent changed the live API response from 403 HTML to 200 JSON. Regression tests cover public responses with both values of `possibly_sensitive` and assert the API identity and absence of credentials. Both tests failed before the fix and passed afterward.

`pnpm verify` passed: typecheck, lint, and 940 tests. `pnpm cf:build` completed. A local Wrangler run using the changed application resolved the reported post with HTTP 200 and served a 206 range response containing MP4 header bytes through `/api/video`. Pre-push verification also passed all 83 local smoke checks with `SMOKE_STRICT=1`, including the configured live platform probes and YouTube audio. A fresh Wrangler dry-run produced a 114.3 KiB bundle within the startup size budget. These are sampled checks, not a guarantee for every public URL; production verification follows the CI deployment.

## Rules

- Reproduce requests with the application's actual headers before blaming the post's sensitivity flag.
- Identify API clients honestly rather than inheriting a browser user-agent from page scrapers.
- Verify the resolver and media proxy together in workerd; metadata alone does not prove a download works.
