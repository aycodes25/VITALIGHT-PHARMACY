export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const categorySlug = slugify

export function findCategoryBySlug(categories, slug) {
  return categories.find((category) => slugify(category.name) === slug) ?? null
}

export function isInStock(product) {
  return Number(product.stock) > 0
}

export function discountPercent(product) {
  if (!product.oldPrice || product.oldPrice <= product.price) return 0
  return Math.round((1 - product.price / product.oldPrice) * 100)
}

export function brandsOf(products) {
  return [...new Set(products.map((product) => product.brand).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
}

export function filterProducts(products, filters = {}) {
  const query = (filters.query || '').trim().toLowerCase()
  return products.filter((product) => {
    if (filters.category && product.category !== filters.category) return false
    if (query && !`${product.name} ${product.brand || ''} ${product.category} ${product.detail || ''}`.toLowerCase().includes(query)) return false
    if (filters.inStockOnly && !isInStock(product)) return false
    if (filters.onSaleOnly && discountPercent(product) === 0) return false
    if (Number.isFinite(filters.minPrice) && product.price < filters.minPrice) return false
    if (Number.isFinite(filters.maxPrice) && product.price > filters.maxPrice) return false
    if (filters.brands?.length && !filters.brands.includes(product.brand)) return false
    return true
  })
}

export function sortProducts(products, sort = 'featured') {
  const list = [...products]
  const byName = (a, b) => a.name.localeCompare(b.name)
  switch (sort) {
    case 'price-asc': return list.sort((a, b) => a.price - b.price || byName(a, b))
    case 'price-desc': return list.sort((a, b) => b.price - a.price || byName(a, b))
    case 'name': return list.sort(byName)
    case 'discount': return list.sort((a, b) => discountPercent(b) - discountPercent(a) || byName(a, b))
    default:
      return list.sort((a, b) =>
        Number(Boolean(b.featured)) - Number(Boolean(a.featured))
        || (a.sort_order ?? 0) - (b.sort_order ?? 0)
        || byName(a, b))
  }
}

export function paginate(items, page = 1, perPage = 12) {
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages)
  return {
    items: items.slice((current - 1) * perPage, current * perPage),
    page: current,
    pages,
    total: items.length,
  }
}

export function relatedProducts(products, product, limit = 4) {
  return sortProducts(
    products.filter((candidate) => candidate.id !== product.id && candidate.category === product.category),
    'featured',
  ).slice(0, limit)
}
