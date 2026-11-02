import { parsePrice } from './price.js'

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }

export function decodeEntities(text) {
  return String(text ?? '').replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6}));/g, (match, dec, hex) => {
    if (dec === undefined && hex === undefined) return ENTITIES[match] ?? match
    const code = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16)
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return match
    try { return String.fromCodePoint(code) } catch { return match }
  })
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

export function makeItem({ name, description, price, oldPrice, currency, images, sourceUrl, category, brand }) {
  const cleanName = clean(name, 120)
  if (cleanName.length < 2) return null
  const parsedPrice = parsePrice(price)
  const parsedOld = parsePrice(oldPrice)
  const imageUrls = [...new Set((Array.isArray(images) ? images : []).map((image) => absoluteUrl(image, sourceUrl)).filter(Boolean))].slice(0, 8)
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
