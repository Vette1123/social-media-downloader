# Sitemap submit to Search Console and Bing on every deploy, 2026-11-21

## What

- Ported portfolio-v1's sitemap submit (same module as Reely): `scripts/lib/search-engines.mjs`.
  The deploy's "Ping IndexNow" step now also resubmits the sitemap to Search Console and Bing
  `SubmitFeed` whenever IndexNow sent URLs. `pnpm seo:submit` does it by hand.
- Secrets `GSC_SERVICE_ACCOUNT_JSON` and `BING_API_KEY` set in GitHub and `.env.local`.
- First live run: Bing 200. Search Console 403: the service account
  (mohamed-gado@sadge-430319) is not a user on `sc-domain:socialdownloader.space` yet. Until it
  is added (Settings > Users and permissions, Full), the deploy logs a warning and carries on.

## Mistakes

- None in the code; the GSC gap was known before starting (neither service account can see this
  property), so the 403 path was tested and made non-fatal first.

## What worked

- Triggering on the IndexNow change set: no second diff of the sitemap.

## Rules

- Bing's site is the apex (`https://socialdownloader.space`); www feeds submit under it.
