import { makeItem } from './normalize.js'

export const SHOPIFY_PAGE_SIZE = 250

export function shopifyFeedUrl(sourceUrl, page) {
  const url = new URL(sourceUrl)
  const collection = url.pathname.match(/^\/collections\/([^/]+)/)
  const feedPath = collection ? `/collections/${collection[1]}/products.json` : '/products.json'
  return `${url.origin}${feedPath}?limit=${SHOPIFY_PAGE_SIZE}&page=${page}`
}

// Returns null when `json` is not a Shopify products feed.
export function parseShopifyProducts(json, origin) {
  if (!json || !Array.isArray(json.products)) return null
  return json.products.map((product) => {
    const first = Array.isArray(product.variants) ? product.variants[0] ?? {} : {}
    return makeItem({
      name: product.title,
      description: product.body_html,
      price: first.price,
      oldPrice: first.compare_at_price,
      currency: '',
      images: (product.images ?? []).map((image) => image?.src),
      sourceUrl: `${origin}/products/${product.handle}`,
      category: product.product_type,
      brand: product.vendor,
    })
  }).filter(Boolean)
}
