import { continueRender, delayRender, staticFile } from 'remotion'

/** Geist at the weights the site's cards use. Every frame waits for all three. */
const WEIGHTS = [400, 600, 800] as const

let loading: Promise<void> | null = null

export function loadFonts() {
  if (loading) return loading
  const handle = delayRender('Geist')
  loading = Promise.all(
    WEIGHTS.map(async (weight) => {
      const face = new FontFace('Geist', `url(${staticFile(`fonts/Geist-${weight}.ttf`)})`, { weight: String(weight) })
      document.fonts.add(await face.load())
    }),
  ).then(() => continueRender(handle))
  return loading
}
