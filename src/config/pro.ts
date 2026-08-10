/**
 * What Pro is, now that it is not for sale.
 *
 * Two merchants of record refused this product category — Lemon Squeezy
 * silently, Creem twice, the second time after every fixable item on their
 * published review checklist had been fixed. The rejections were about the
 * category, not the copy, so the response is to stop selling rather than to
 * reword the same offer a third time.
 *
 * The features stayed. They are granted by hand now: a row in `users` carries
 * `grants = 'pro'`, set with one `wrangler d1 execute` after someone supports
 * the project. No checkout, no subscription, no merchant of record, nothing to
 * cancel and nothing to refund — a donation with a thank-you attached is not a
 * sale, and that is the whole point.
 *
 * The checkout links, the plan variants and the price constants that used to
 * live here are gone rather than commented out; git has them if a processor is
 * ever found. What survives is the description of the offer, because that is
 * still shown on the support page.
 */

/**
 * What supporters get, in the order it matters.
 *
 * Every line describes *less standing over it*, never more reach. Nothing here
 * unlocks content a visitor cannot already download, and a line that implied
 * otherwise would be the acceptable-use clause that ended the store — not
 * merely overstated copy. That constraint outlived the store: it is why the
 * `ig` grant is deliberately not on this list and is not something anyone can
 * obtain by supporting the project.
 */
export const PRO_BENEFITS = [
  'Paste a list and let the queue run',
  'Priority resolving on every link',
  'Images and audio bundled into one ZIP',
  'No sponsor card, site-wide',
] as const
