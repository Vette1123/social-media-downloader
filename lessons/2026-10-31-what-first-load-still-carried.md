# What first load still carried

## What
Second pass after the page-weight fix. The accordion library, four translation
dictionaries and the support panel's copy no longer ship on first load. Sitemap
`lastmod` and JSON-LD `dateModified` come from git instead of the build clock.
One title and one description were cut to fit a search result, and a test now
holds every platform page to those limits. Live redirects, the 404 status and
the filmstrip were checked and needed nothing.

## Mistakes
- **Reported live Speed Index as an unexplained gap.** The filmstrip answered it
  in one look: blank, then complete, and no change after. Nothing renders late;
  the figure is Lighthouse modelling first connection on this network. That check
  should have come before the report, not after.
- **Read a 403 on every live URL as a possible outage for a moment.** It was the
  WAF challenging the `HeadlessChrome` user agent, which is its job.
- **Long heredocs fail in this Git Bash** with an unexpected-EOF error. Scripts go
  through the Write tool.
- **`current = next` could not stay ahead of the dictionary.** The store's snapshot
  has to change after the load, or nothing re-renders into the translated copy.

## What worked
- Coverage per chunk, then reading the strings inside it, found the Spanish copy
  and the idle accordion load quickly.
- Testing the language switch in a real browser after changing its path.

## Rules
- A client component that only hides itself should wrap server markup instead.
- A loader that fires "on idle, just in case" needs a reason a visitor benefits.
- `lastmod` means the content changed. A deploy is not a content change.
