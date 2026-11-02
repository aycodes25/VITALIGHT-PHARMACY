import { absoluteUrl, indexOfCI, makeItem, text } from './normalize.js'

const LD_TYPE = /type=["']application\/ld\+json["']/i
const MAX_BLOCKS = 50
const MAX_NODES = 5000
const MAX_DEPTH = 12
const MAX_RESULTS = 500

const isObject = (value) => value !== null && typeof value === 'object'
const asList = (value) => (Array.isArray(value) ? value : value == null ? [] : [value])

// Linear scan for <script type="application/ld+json"> bodies. An unterminated tag or script ends the scan.
function* scriptBodies(html) {
  let from = 0
  while (true) {
    const start = indexOfCI(html, '<script', from)
    if (start === -1) return
    const tagEnd = html.indexOf('>', start + 7)
    if (tagEnd === -1) return
    if (!LD_TYPE.test(html.slice(start + 7, tagEnd))) {
      from = tagEnd + 1
      continue
    }
    const close = indexOfCI(html, '</script', tagEnd + 1)
    if (close === -1) return
    yield html.slice(tagEnd + 1, close)
    const closeEnd = html.indexOf('>', close + 8)
    if (closeEnd === -1) return
    from = closeEnd + 1
  }
}

function parseBlocks(html) {
  const blocks = []
  for (const body of scriptBodies(text(html))) {
    if (blocks.length >= MAX_BLOCKS) break
    try {
      blocks.push(JSON.parse(body.trim()))
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
