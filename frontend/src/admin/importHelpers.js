const MAX_MONEY = 100000000

export function draftFromItem(item) {
  const data = item.data ?? {}
  return {
    name: data.name ?? '',
    detail: String(data.description ?? '').slice(0, 240),
    brand: data.brand ?? '',
    tag: '',
    category: item.suggested_category || '',
    price: data.price ?? '',
    old_price: data.old_price ?? '',
    stock: 0,
    images: Array.isArray(data.images) ? data.images : [],
  }
}

const isBlank = (value) => value === '' || value === null || value === undefined
const isWhole = (value, max) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= max

export function itemProblems(draft) {
  const problems = []
  const name = String(draft.name).trim()
  if (name.length < 2 || name.length > 120) problems.push('Enter a product name (2 to 120 characters).')
  if (!draft.category) problems.push('Choose a category.')
  if (isBlank(draft.price) || !isWhole(draft.price, MAX_MONEY)) problems.push('Enter the price as a whole number.')
  if (!isBlank(draft.old_price) && !isWhole(draft.old_price, MAX_MONEY)) problems.push('The original price must be a whole number or empty.')
  if (isBlank(draft.stock) || !isWhole(draft.stock, 1000000)) problems.push('Enter the stock quantity.')
  if (String(draft.detail).trim().length > 240) problems.push('The description can be up to 240 characters.')
  if (String(draft.tag).trim().length > 30) problems.push('The badge can be up to 30 characters.')
  return problems
}

export function payloadFromDraft(draft) {
  return {
    name: String(draft.name).trim(),
    detail: String(draft.detail).trim(),
    brand: String(draft.brand ?? '').trim(),
    tag: String(draft.tag).trim(),
    category: draft.category,
    price: Number(draft.price),
    old_price: isBlank(draft.old_price) ? null : Number(draft.old_price),
    stock: Number(draft.stock),
    image_urls: draft.images,
    is_active: true,
    featured: false,
    art: 'vitamin',
    color: 'lavender',
  }
}

export function summarize(items) {
  const count = (status) => items.filter((item) => item.status === status).length
  return { total: items.length, pending: count('pending'), approved: count('approved'), rejected: count('rejected') }
}

export function safeHttpUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}
