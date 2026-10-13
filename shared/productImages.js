// Ordered, de-duplicated photo URLs for a product. image_url is the primary
// photo and always comes first; images (migration 003) holds the full gallery.
export function productImages(product) {
  if (!product) return []
  const gallery = Array.isArray(product.images) ? product.images.filter((url) => typeof url === 'string' && url) : []
  const primary = typeof product.image_url === 'string' && product.image_url ? product.image_url : null
  const list = primary ? [primary, ...gallery] : gallery
  return [...new Set(list)]
}
