import { makeItem } from './normalize.js'

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
        images: (product.images ?? []).map((image) => image?.src),
        sourceUrl: product.permalink || origin,
        category: product.categories?.[0]?.name,
        brand: product.brands?.[0]?.name,
      })
    })
    .filter(Boolean)
}
