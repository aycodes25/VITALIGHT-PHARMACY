import { absoluteUrl, makeItem } from './normalize.js'

export const WOO_PAGE_SIZE = 50

// Optional locale prefix such as /en or /en-ng.
const LOCALE = /^\/[a-z]{2}(?:-[a-z]{2,4})?(?=\/|$)/i

// The Store API feed for a shop page (/, /shop) or a product category page; null for anything
// else (single products, other pages), which are read as html instead.
export function wooFeedUrl(sourceUrl, page) {
  const url = new URL(sourceUrl)
  const path = url.pathname.replace(LOCALE, '').replace(/\/+$/, '')
  const base = `${url.origin}/wp-json/wc/store/v1/products?per_page=${WOO_PAGE_SIZE}&page=${page}`
  if (path === '' || /^\/shop$/i.test(path)) return base
  const category = path.match(/^\/product-category\/((?:[^/]+\/)*)([^/]+)$/i)
  if (category) return `${base}&category=${category[2]}`
  return null
}

// Returns null when `json` is not a WooCommerce Store API product list.
export function parseWooProducts(json, origin) {
  if (!Array.isArray(json)) return null
  return json
    .filter((product) => product && typeof product === 'object' && 'prices' in product)
    .map((product) => {
      const minor = Number(product.prices?.currency_minor_unit ?? 2)
      const divisor = 10 ** (Number.isFinite(minor) ? minor : 2)
      const major = (value) => (value === '' || value === null || value === undefined ? null : Number(value) / divisor)
      return makeItem({
        name: product.name,
        description: product.short_description || product.description,
        price: major(product.prices?.price),
        oldPrice: major(product.prices?.regular_price),
        currency: product.prices?.currency_code,
        images: (Array.isArray(product.images) ? product.images : []).map((image) => image?.src),
        sourceUrl: absoluteUrl(product.permalink, origin) ?? origin,
        category: (Array.isArray(product.categories) ? product.categories[0] : null)?.name,
        brand: (Array.isArray(product.brands) ? product.brands[0] : null)?.name,
      })
    })
    .filter(Boolean)
}
