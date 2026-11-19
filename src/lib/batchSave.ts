/**
 * Where a batch item's video bytes come from.
 *
 * Only an attachment URL (a Cobalt tunnel, a recipe-built link) may be handed
 * to a hidden navigation: the browser saves it. A raw CDN file navigated to
 * plays inline and nothing is saved, while the batch logged it as delivered.
 * Such a URL is read with fetch() instead, before the proxy, which stays the
 * last resort.
 */
export function batchSaveSources(
  meta: { directVideoUrl?: string; directIsAttachment?: boolean } | undefined,
  proxiedUrl: string | undefined,
): { navigate?: string; fetch: string[] } {
  const direct = meta?.directVideoUrl
  if (direct && meta?.directIsAttachment === true) return { navigate: direct, fetch: [] }
  return { fetch: [direct, proxiedUrl].filter((u): u is string => Boolean(u)) }
}
