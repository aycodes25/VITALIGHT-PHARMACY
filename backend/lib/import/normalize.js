import { parsePrice } from './price.js'

export const MAX_HTML = 5_000_000

// Bounded string view of scraped HTML; anything that is not a string becomes ''.
export const text = (html) => (typeof html === 'string' ? html.slice(0, MAX_HTML) : '')

const isWordChar = (code) => (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95

// Case-insensitive indexOf for a lowercase ASCII needle starting with '<'. Linear: never backtracks.
export function indexOfCI(html, needle, from = 0) {
  let i = html.indexOf('<', from)
  while (i !== -1) {
    if (html.slice(i, i + needle.length).toLowerCase() === needle) return i
    i = html.indexOf('<', i + 1)
  }
  return -1
}

// Yields { tag, start, end } for each `<name ...>` (names are lowercase; case-insensitive match, word boundary after the name).
// Stops entirely when a tag has no closing '>'. Linear in the input length.
export function* findTags(html, names) {
  const wanted = names.map((name) => name.toLowerCase())
  let i = html.indexOf('<')
  while (i !== -1) {
    const name = wanted.find((candidate) => {
      if (html.slice(i + 1, i + 1 + candidate.length).toLowerCase() !== candidate) return false
      const next = html.charCodeAt(i + 1 + candidate.length)
      return Number.isNaN(next) || !isWordChar(next)
    })
    if (name === undefined) {
      i = html.indexOf('<', i + 1)
      continue
    }
    const close = html.indexOf('>', i + 1 + name.length)
    if (close === -1) return
    yield { tag: html.slice(i, close + 1), start: i, end: close + 1 }
    i = html.indexOf('<', close + 1)
  }
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }

export function decodeEntities(text) {
  return String(text ?? '').replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6}));/g, (match, dec, hex) => {
    if (dec === undefined && hex === undefined) return ENTITIES[match] ?? match
    const code = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16)
    if (!Number.isInteger(code) || code > 0x10ffff) return match
    // Leave NUL, lone surrogates and control characters (except tab, LF, CR) as written: Postgres rejects them.
    if (code === 0 || (code >= 0xd800 && code <= 0xdfff)) return match
    if ((code < 0x20 && code !== 9 && code !== 10 && code !== 13) || (code >= 0x7f && code <= 0x9f)) return match
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
  if (cleanName.length < 1) return null
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
