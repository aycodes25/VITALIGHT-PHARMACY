import { parsePrice } from './price.js'

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }

export function decodeEntities(text) {
  return String(text ?? '').replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (match) => ENTITIES[match])
}

// Plain text from possibly-HTML input: tags removed first, then entities decoded, then whitespace collapsed.
function clean(value, max) {
  if (typeof value !== 'string') return ''
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, max)
}

export function absoluteUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim(), base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function makeItem({ name, description, price, oldPrice, currency, images = [], sourceUrl, category, brand }) {
  const cleanName = clean(name, 120)
  if (cleanName.length < 2) return null
  const parsedPrice = parsePrice(price)
  const parsedOld = parsePrice(oldPrice)
  const imageUrls = [...new Set(images.map((image) => absoluteUrl(image, sourceUrl)).filter(Boolean))].slice(0, 8)
  return {
    name: cleanName,
    description: clean(description, 240),
    price: parsedPrice,
    old_price: parsedOld !== null && parsedPrice !== null && parsedOld > parsedPrice ? parsedOld : null,
    currency: typeof currency === 'string' ? currency.trim().toUpperCase().slice(0, 3) : '',
    images: imageUrls,
    source_url: sourceUrl,
    source_category: clean(category, 80),
    brand: clean(brand, 60),
  }
}
