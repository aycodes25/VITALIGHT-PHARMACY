import { decodeEntities, makeItem } from './normalize.js'

const MAX_HTML = 5_000_000
const quoted = (attr) => new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
const NAME_ATTR = quoted('(?:property|name)')
const CONTENT_ATTR = quoted('content')

function metaContent(html, key) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const nameMatch = tag.match(NAME_ATTR)
    const name = nameMatch?.[1] ?? nameMatch?.[2]
    if (name?.toLowerCase() === key) {
      const contentMatch = tag.match(CONTENT_ATTR)
      const content = contentMatch?.[1] ?? contentMatch?.[2]
      return content === undefined ? null : decodeEntities(content)
    }
  }
  return null
}

// Last-resort extraction from OpenGraph / product meta tags. Needs a price so that ordinary pages are not mistaken for products.
export function extractMetaProduct(rawHtml, pageUrl) {
  const html = typeof rawHtml === 'string' ? rawHtml.slice(0, MAX_HTML) : ''
  const price = metaContent(html, 'product:price:amount') ?? metaContent(html, 'og:price:amount')
  if (!price) return null
  const title = metaContent(html, 'og:title') ?? decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '')
  return makeItem({
    name: title,
    description: metaContent(html, 'og:description'),
    price,
    currency: metaContent(html, 'product:price:currency') ?? metaContent(html, 'og:price:currency'),
    images: [metaContent(html, 'og:image')],
    sourceUrl: pageUrl,
    category: metaContent(html, 'product:category'),
    brand: metaContent(html, 'product:brand'),
  })
}
