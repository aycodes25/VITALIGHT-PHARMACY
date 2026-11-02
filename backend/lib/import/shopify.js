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
    if (!product || typeof product !== 'object') return null
    if (typeof product.handle !== 'string' || !product.handle) return null
    const variants = Array.isArray(product.variants) ? product.variants : []
    const images = Array.isArray(product.images) ? product.images : []
    const first = variants[0] && typeof variants[0] === 'object' ? variants[0] : {}
    return makeItem({
      name: product.title,
      description: product.body_html,
      price: first.price,
      oldPrice: first.compare_at_price,
      currency: '',
      images: images.map((image) => image?.src),
      sourceUrl: `${origin}/products/${encodeURIComponent(product.handle)}`,
      category: product.product_type,
      brand: product.vendor,
    })
  }).filter(Boolean)
}
