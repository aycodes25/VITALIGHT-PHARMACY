import { decodeEntities, findTags, makeItem, text } from './normalize.js'

const quoted = (attr) => new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
const NAME_ATTR = quoted('(?:property|name)')
const CONTENT_ATTR = quoted('content')

function metaContent(html, key) {
  for (const { tag } of findTags(html, ['meta'])) {
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

// Text of the first <title> whose content (no '<') is directly followed by </title>.
function titleText(html) {
  for (const { end } of findTags(html, ['title'])) {
    const lt = html.indexOf('<', end)
    if (lt === -1) return ''
    if (html.slice(lt, lt + 8).toLowerCase() === '</title>') return decodeEntities(html.slice(end, lt))
  }
  return ''
}

// Last-resort extraction from OpenGraph / product meta tags. Needs a price so that ordinary pages are not mistaken for products.
export function extractMetaProduct(rawHtml, pageUrl) {
  const html = text(rawHtml)
  const price = metaContent(html, 'product:price:amount') ?? metaContent(html, 'og:price:amount')
  if (!price) return null
  const title = metaContent(html, 'og:title') ?? titleText(html)
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
