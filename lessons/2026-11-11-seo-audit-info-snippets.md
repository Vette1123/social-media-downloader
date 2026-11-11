# SEO audit: info-page snippets

## What

Full audit of all 80 sitemap URLs (5 languages) on the live site: status, title, description, h1 count, canonical,
lang, og/twitter, noindex, JSON-LD parse, duplicates, lastmod, robots, apex redirect, 404. Everything passed except
the /terms description in es, pt and id, which rendered at 163, 176 and 165 characters once `{site}` became
"Social Media Downloader". Shortened the three and made `seoLimits.test.ts` measure the rendered /pro, /privacy and
/terms snippets in every language.

## Mistakes

- First audit pass flagged two platform titles at 61 and 63 characters. The script counted `&amp;` as five characters;
  decoded they are 57 and 59. Decode entities before measuring.
- The existing limits test measured platform pages only, and the info-page template (`{site}`) hides its real length.

## What worked

- Crawling the sitemap itself as the route list, so no indexable page was missed.
- Writing the failing test first: 3 red, then green after the copy change.

## Rules

- Measure what the page ships (filled, decoded), never the template.
- A plain curl gets a Cloudflare challenge (403); send a browser user agent when auditing.
