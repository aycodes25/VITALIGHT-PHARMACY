import { absoluteUrl, makeItem } from './normalize.js'

export const WOO_PAGE_SIZE = 100

export function wooFeedUrl(sourceUrl, page) {
  return `${new URL(sourceUrl).origin}/wp-json/wc/store/v1/products?per_page=${WOO_PAGE_SIZE}&page=${page}`
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
