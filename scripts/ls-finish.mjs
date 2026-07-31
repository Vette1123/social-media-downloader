/**
 * Post-dashboard Lemon Squeezy wiring. Run after the product exists.
 *
 * Reads the API key from .env.local, finds the $9 variant, verifies its
 * license settings against what /pro claims in user-facing copy, and patches
 * CHECKOUT_URL in src/app/pro/page.tsx.
 *
 * Never prints the API key.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const REPO = 'C:/HighSpeed/Personal/Next/social-media-downloader'
const PRO_PAGE = `${REPO}/src/app/pro/page.tsx`
const EXPECTED_PRICE_CENTS = 900
const EXPECTED_ACTIVATION_LIMIT = 5

const env = readFileSync(`${REPO}/.env.local`, 'utf8')
const key = env.match(/^LEMONSQUEEZY_API_KEY=(.+)$/m)?.[1].trim()
if (!key) throw new Error('LEMONSQUEEZY_API_KEY missing from .env.local')

const H = {
  Accept: 'application/vnd.api+json',
  'Content-Type': 'application/vnd.api+json',
  Authorization: `Bearer ${key}`,
}

async function api(path) {
  const r = await fetch(`https://api.lemonsqueezy.com${path}`, { headers: H })
  const text = await r.text()
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

const problems = []
const notes = []

const PREFERRED_STORE_SLUG = 'gadolabs'

const stores = await api('/v1/stores')
// The account may hold an older store; never guess by position.
const store =
  stores.data.find((s) => s.attributes.slug === PREFERRED_STORE_SLUG) ?? stores.data[0]
if (!stores.data.some((s) => s.attributes.slug === PREFERRED_STORE_SLUG)) {
  notes.push(
    `no store with slug "${PREFERRED_STORE_SLUG}"; fell back to "${store.attributes.slug}"`,
  )
}
if (stores.data.length > 1) {
  notes.push(`${stores.data.length} stores in the account: ${stores.data.map((s) => s.attributes.slug).join(', ')}`)
}
const storeSlug = store.attributes.slug

if (store.attributes.currency !== 'USD') {
  problems.push(
    `store currency is ${store.attributes.currency}, not USD — a "$9" product would be priced in ${store.attributes.currency}`,
  )
}
console.log(`store: ${store.attributes.name} (id ${store.id}, slug ${storeSlug})`)

const products = await api(`/v1/products?filter[store_id]=${store.id}`)
if (products.data.length === 0) {
  console.error('\nNo products yet. Create one in the dashboard first, then re-run.')
  process.exit(1)
}
for (const p of products.data) console.log(`product: ${p.attributes.name} (id ${p.id})`)
const product = products.data[0]

const variants = await api(`/v1/variants?filter[product_id]=${product.id}`)
if (variants.data.length === 0) throw new Error('product has no variants')

// A product with one price still exposes a "default" variant; pick the one
// priced at $9 if several exist rather than assuming index 0.
const priced = variants.data.filter((v) => v.attributes.price === EXPECTED_PRICE_CENTS)
const variant = priced[0] ?? variants.data[0]
const a = variant.attributes

console.log(`variant: ${a.name} (id ${variant.id}) price=${a.price} cents`)

if (a.price !== EXPECTED_PRICE_CENTS) {
  problems.push(`price is ${a.price} cents, /pro copy says $9 (${EXPECTED_PRICE_CENTS} cents)`)
}
if (!a.has_license_keys) {
  problems.push('license keys are OFF for this variant — activation would always fail')
}
if (a.license_activation_limit !== EXPECTED_ACTIVATION_LIMIT) {
  problems.push(
    `activation limit is ${a.license_activation_limit}, ` +
      `but /pro and ProLicensePanel both say "five activation slots"`,
  )
}
if (a.is_license_limit_unlimited) {
  problems.push(
    `activation limit is set to unlimited — /pro claims a ${EXPECTED_ACTIVATION_LIMIT}-device cap`,
  )
}
if (!a.is_license_length_unlimited) {
  notes.push(
    `license length is limited (${a.license_length_value} ${a.license_length_unit}); ` +
      '/pro sells a lifetime license',
  )
}

// `buy_now_url` is what the dashboard's own Share dialog hands out, and the
// only form that resolves. The legacy `/buy/<variant-id>` shape this used to
// construct 404s — it predates the UUID checkout URLs — so the constructed one
// survives strictly as a fallback for a payload without the field.
const checkoutUrl =
  product.attributes.buy_now_url ||
  `https://${storeSlug}.lemonsqueezy.com/buy/${variant.id}`
console.log(`checkout: ${checkoutUrl}`)
if (!product.attributes.buy_now_url) {
  notes.push('product had no buy_now_url; fell back to a constructed checkout URL')
}

// A single-price product reports its default variant as `pending` even once the
// product itself is published, so this is a note, not a blocker — the HEAD
// below is what actually decides whether the checkout is reachable.
if (a.status !== 'published') {
  notes.push(`variant status is "${a.status}" (normal for a single-price product)`)
}

const head = await fetch(checkoutUrl, { method: 'HEAD', redirect: 'manual' })
console.log(`checkout HEAD -> ${head.status}`)
if (head.status >= 400) problems.push(`checkout URL returned ${head.status} — not live yet`)

if (problems.length) {
  console.error('\nBLOCKING:')
  for (const p of problems) console.error(`  - ${p}`)
  console.error('\nNot patching the code. Fix these in the dashboard and re-run.')
  process.exit(1)
}

const src = readFileSync(PRO_PAGE, 'utf8')
const next = src.replace(
  /const CHECKOUT_URL = '[^']*'/,
  `const CHECKOUT_URL = '${checkoutUrl}'`,
)
if (next === src) throw new Error('CHECKOUT_URL line not found or already set to this value')
writeFileSync(PRO_PAGE, next)

console.log('\npatched src/app/pro/page.tsx')
if (notes.length) {
  console.log('\nnotes:')
  for (const n of notes) console.log(`  - ${n}`)
}
