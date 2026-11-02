import { absoluteUrl, makeItem } from './normalize.js'

const SCRIPT = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const MAX_BLOCKS = 50
const MAX_NODES = 5000
const MAX_DEPTH = 12
const MAX_RESULTS = 500
const MAX_HTML = 5_000_000

const isObject = (value) => value !== null && typeof value === 'object'
const asText = (html) => (typeof html === 'string' ? html.slice(0, MAX_HTML) : '')
const asList = (value) => (Array.isArray(value) ? value : value == null ? [] : [value])

function parseBlocks(html) {
  const blocks = []
  for (const match of asText(html).matchAll(SCRIPT)) {
    if (blocks.length >= MAX_BLOCKS) break
    try {
      blocks.push(JSON.parse(match[1].trim()))
    } catch {
      // Invalid (or absurdly deep) JSON-LD is common; skip the block.
    }
  }
  return blocks
}

// Bounded, non-recursive walk: hostile JSON-LD cannot exhaust the stack or the node budget.
function* walk(root) {
  const stack = [[root, 0]]
  let seen = 0
  while (stack.length && seen < MAX_NODES) {
    const [node, depth] = stack.pop()
    if (Array.isArray(node)) {
      if (depth < MAX_DEPTH) for (let i = node.length - 1; i >= 0; i -= 1) stack.push([node[i], depth + 1])
      continue
    }
    if (!isObject(node)) continue
    seen += 1
    yield node
    if (depth >= MAX_DEPTH) continue
    for (const key of ['mainEntity', 'item', 'itemListElement', '@graph']) {
      if (node[key]) stack.push([node[key], depth + 1])
    }
  }
}

const hasType = (node, type) => asList(node['@type']).includes(type)

const first = (value) => asList(value)[0]

function readOffer(node) {
  if (!isObject(node)) return {}
  const offers = asList(node.offers)
    .flatMap((offer) => (isObject(offer) && offer.offers ? asList(offer.offers) : [offer]))
    .filter(isObject)
  const offer = offers[0]
  if (!offer) return {}
  const spec = first(offer.priceSpecification)
  const specObj = isObject(spec) ? spec : {}
  return { price: offer.price ?? offer.lowPrice ?? specObj.price, currency: offer.priceCurrency ?? specObj.priceCurrency }
}

const imageUrls = (image) => asList(image).map((entry) => (typeof entry === 'string' ? entry : isObject(entry) ? entry.url ?? entry.contentUrl : null))
const nameOf = (value) => {
  const one = first(value)
  return typeof one === 'string' ? one : isObject(one) ? one.name : undefined
}

export function extractJsonLdProducts(html, pageUrl) {
  const items = []
  for (const block of parseBlocks(html)) {
    for (const node of walk(block)) {
      const isGroup = hasType(node, 'ProductGroup')
      if (!isGroup && !hasType(node, 'Product')) continue
      const variant = isGroup ? first(node.hasVariant) : null
      const { price, currency } = readOffer(isGroup && isObject(variant) ? variant : node)
      const item = makeItem({
        name: node.name,
        description: node.description,
        price: typeof price === 'string' || typeof price === 'number' ? price : null,
        currency,
        images: imageUrls(node.image),
        sourceUrl: absoluteUrl(node.url, pageUrl) ?? pageUrl,
        category: nameOf(node.category),
        brand: nameOf(node.brand),
      })
      if (item) items.push(item)
      if (items.length >= MAX_RESULTS) return items
    }
  }
  return items
}

// URLs listed in schema.org ItemList / ListItem entries (product listing pages).
export function extractJsonLdItemUrls(html, pageUrl) {
  const urls = new Set()
  const addEntry = (entry) => {
    if (!isObject(entry)) return
    const item = entry.item
    const candidate = entry.url ?? (isObject(item) ? item.url ?? item['@id'] : item)
    const abs = absoluteUrl(candidate, pageUrl)
    if (abs) urls.add(abs)
  }
  for (const block of parseBlocks(html)) {
    for (const node of walk(block)) {
      // Entries of an ItemList are often untyped, so trust everything under itemListElement.
      for (const entry of asList(node.itemListElement)) addEntry(entry)
      if (hasType(node, 'ListItem')) addEntry(node)
      if (urls.size >= MAX_RESULTS) return [...urls]
    }
  }
  return [...urls]
}
