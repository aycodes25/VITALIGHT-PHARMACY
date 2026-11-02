const words = (text) => (typeof text === 'string' ? text : '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2)
const stem = (word) => word.replace(/s$/, '')
const normalizeName = (name) => (typeof name === 'string' ? name : '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Best-guess category for the review screen: the category sharing the most words with the source category/name.
export function suggestCategory(item, categories) {
  const haystack = new Set([...words(item?.source_category), ...words(item?.name)].map(stem))
  let best = ''
  let bestScore = 0
  for (const category of Array.isArray(categories) ? categories : []) {
    const score = words(category?.name).map(stem).filter((word) => haystack.has(word)).length
    if (score > bestScore) {
      best = category.name
      bestScore = score
    }
  }
  return best
}

export function findDuplicate(item, existingProducts) {
  const key = normalizeName(item?.name)
  return key ? (Array.isArray(existingProducts) ? existingProducts : []).find((product) => normalizeName(product?.name) === key) ?? null : null
}

// Result only ever contains [a-z0-9-] (so it is safe in a LIKE pattern) and is at most 50 characters.
export function slugify(name) {
  const text = typeof name === 'string' ? name : ''
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/g, '') || 'product'
}

export function uniqueSlug(base, takenIds) {
  if (!takenIds.has(base)) return base
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`
    if (!takenIds.has(candidate)) return candidate
  }
}
