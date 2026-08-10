# Creem payout-account rejection

## What

Creem rejected the payout account on compliance grounds two days after the store
went live, pointing at their prohibited-products and acceptable-use pages. Their
published review checklist has ten items; the site was audited against all ten
and the four failures were fixed:

1. **Support address not on the site.** It existed in `siteConfig` and rendered
   on `/pro` and `/terms` only. "Support email doesn't match between your
   business details and your website" is the first common rejection reason they
   list. It now renders on every page, as readable text and not only as a link.
2. **Blanket "no refunds".** A subscription sold with charges declared final,
   next to a merchant-of-record whose own buyer terms cite the EU 14-day
   withdrawal right. Replaced with 14 days, no questions asked, stated
   identically on `/pro`, `/terms` and the cancel screen in the account panel.
3. **"Watermark-free" as the headline claim.** It was in the `h1`, the meta
   title and description, the OG image, the JSON-LD `HowTo` names, the PWA
   manifest, the platform pages and the meta keywords — including the literal
   keyword `watermark remover`. All of it reframed around *original quality*:
   the source file a platform serves for a public post, not a re-encode and not
   a screen recording. The behaviour never changed; the description of it did.
4. **No affiliation disclaimer on the pages carrying platform logos.** It lived
   in `/terms` only. Now in the shared footer, next to the support address.

Two smaller things went with it: the meta keywords that traded on other
downloaders' brand names (`y2mate alternative`, `snapinsta alternative`, …) were
deleted, and so was `src/lib/videoProcessor.ts` — a dead module whose functions
were `removeWatermark` and `removeWatermarkFromUrl`, sitting in a public repo
that is linked from the site footer.

## Mistakes

- **The obvious read was nearly the wrong one.** The first instinct was that the
  rejection was the product category — a third-party downloader, exactly what
  Lemon Squeezy silently refused two days earlier — and therefore unfixable by
  editing anything. Checking the actual checklist first turned up four concrete
  failures, two of which (support address, refund policy) have nothing to do with
  the category at all. Read the checklist before concluding it doesn't apply.
- **The compliance boundary was policed in the product and not in the copy.**
  `/pro`, `/terms` and the entitlement rules were already careful and explicit —
  public content only, no credentials, no reach widened by a paid tier. The home
  page meanwhile led with "Download any video, watermark-free" and shipped
  `watermark remover` as a keyword. The `project-mor-acceptable-use` memory says
  in as many words that rewording marketing does not fix an unsellable feature;
  the inverse was never written down and is just as true — correct *features*
  do not fix marketing that describes a circumvention tool.
- **Deleting the marketing keywords felt like an SEO cost and isn't one.** Google
  has ignored the `keywords` meta tag since 2009. The cost of that block was
  entirely on the review side: machine-readable text, on the page, describing
  watermark removal. It should have been deleted long before a payment provider
  read it.
- **The refund policy change opened a hole in the entitlement.** Offering refunds
  while `refund.created` stays unsubscribed means a refunded annual keeps Pro to
  period end — a refund does not move `sub_status`, and both `canceled` and
  `scheduled_cancel` deliberately run to `sub_ends_at`. Left as a manual
  `UPDATE users SET sub_ends_at = <now>` documented in `entitlement.ts` rather
  than a webhook path, because refunds arrive by email one at a time; noted
  here so the tradeoff is not rediscovered as a bug.
- **Two footers had already drifted.** The home page's was hardcoded and the
  platform pages' read from `siteConfig`; the separators even differed (`·` vs
  `•`). Adding the support address to both would have been the third copy of the
  divergence. Extracted to `SiteFooter` first, then added it once.

## What worked

- Auditing against the provider's own published checklist, item by item, instead
  of guessing at the rejection reason from the generic email. Six of the ten
  items already passed, which turned an open-ended panic into four edits.
- Grepping for the risky *string* across the whole repo rather than the risky
  page. `watermark` appeared in twelve files, including the PWA manifest, the OG
  image generator, the Play-Store screenshot renderer, `llms.txt` and the README
  — a page-by-page pass would have missed most of them.
- Verifying against the built export (`out/*.html`) rather than the source: it
  is what a reviewer loads, and it caught the two files (`public/manifest.json`,
  the README behind the footer's GitHub link) that source edits had not reached.

## Rules

- Marketing copy is compliance surface. Before writing a claim, ask whether it
  describes *removing, bypassing, or unlocking* something. Describe what is
  gained (original quality, the source file), never what is stripped.
- Never trade on another product's brand name in keywords, titles or copy —
  especially not one with a piracy reputation. It costs nothing to drop and
  positions the business next to them for anyone reviewing it.
- A support address must render on every page, as text, from `siteConfig`, and
  must match what is filed with the payment provider.
- Never sell a subscription with a blanket no-refund clause. 14 days is the
  floor consumer law assumes anyway.
- After a copy change of this kind, grep the built `out/` directory, not just
  `src/` — `public/`, generated images and the README ship too.
- When a fix has to land in two files, extract the shared thing first and apply
  the fix once.
