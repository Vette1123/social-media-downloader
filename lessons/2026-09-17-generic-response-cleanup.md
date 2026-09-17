# Cancel responses the generic resolver does not use

## What

The generic page scraper now cancels unsuccessful and non-HTML response bodies before returning no result. Direct media responses retain their existing cancellation behavior. One shared branch handles all discarded bodies without changing extractor order or adding requests.

## Mistakes

An initial replacement left a duplicate object fragment in the method. Reading the resulting code caught it; it was removed before verification. Earlier production timing samples included connection failures and possible cache hits, so they do not establish a speed improvement from this change.

## What worked

Three new cancellation assertions failed before the fix. All five added cases now pass, covering rejected responses, unsupported content types, direct media, and cancellation errors. `pnpm verify` passed typecheck, lint, and 945 tests. `pnpm cf:build` completed, and all 83 strict smoke checks passed against a local Wrangler instance. A fresh dry-run bundle measured 114.3 KiB raw and 37.9 KiB gzipped.

## Rules

Cancel response bodies that will not be consumed, and keep cleanup errors from interrupting fallback. Passing sampled smoke checks does not prove every URL works. This change reduces unused stream retention; no production latency improvement has been measured. Nothing was committed or deployed for this change.
