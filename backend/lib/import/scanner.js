import { fetchJson, fetchText } from './safeFetch.js'
import { ImportError } from './urlSafety.js'
import { SHOPIFY_PAGE_SIZE, parseShopifyProducts, shopifyFeedUrl } from './shopify.js'
import { WOO_PAGE_SIZE, parseWooProducts, wooFeedUrl } from './woocommerce.js'
import { extractJsonLdProducts } from './jsonld.js'
import { extractMetaProduct } from './meta.js'
import { findNextPageUrl, findProductLinks, looksLikeProductUrl } from './links.js'

export const LIMITS = { maxProducts: 200, maxListingPages: 20, productFetchesPerStep: 5 }
export const NO_DATA_MESSAGE = 'This site does not expose product data that can be read automatically. Try a shop or category page, or add the products manually.'
const STALE_MESSAGE = 'This scan can no longer be continued. Start a new scan.'
const MAX_URL_LENGTH = 2048

const FEEDS = {
  shopify: { feedUrl: shopifyFeedUrl, parse: parseShopifyProducts, pageSize: SHOPIFY_PAGE_SIZE },
  woocommerce: { feedUrl: wooFeedUrl, parse: parseWooProducts, pageSize: WOO_PAGE_SIZE },
}
const rawCount = (json) => {
  if (Array.isArray(json)) return json.length
  return Array.isArray(json?.products) ? json.products.length : 0
}

export function productsFromHtml(html, pageUrl) {
  const fromJsonLd = extractJsonLdProducts(html, pageUrl)
  if (fromJsonLd.length) return fromJsonLd
  const fromMeta = extractMetaProduct(html, pageUrl)
  return fromMeta ? [fromMeta] : []
}

// ---- same-site checks (a scanned site is untrusted; stored cursors must stay on it) ----

const siteKey = (url) => `${url.hostname.replace(/^www\./i, '').toLowerCase()}:${url.port}`

function sameSiteUrl(value, source) {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return null
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return siteKey(url) === siteKey(source) ? url.href : null
}

function sameSiteList(values, source, max) {
  if (!Array.isArray(values)) return []
  const out = new Set()
  for (const value of values) {
    if (out.size >= max) break
    const href = sameSiteUrl(value, source)
    if (href) out.add(href)
  }
  return [...out]
}

const boundedInt = (value, min, max) => (Number.isInteger(value) && value >= min && value <= max ? value : null)

const staleScan = () => new ImportError(STALE_MESSAGE, 400)

// ---- platform feeds (Shopify / WooCommerce) ----

async function readFeed(mode, source, page, opts) {
  const feed = FEEDS[mode]
  const json = await fetchJson(feed.feedUrl(source.href, page), opts).catch(() => null)
  const items = json ? feed.parse(json, source.origin) : null
  return { items: Array.isArray(items) ? items : null, count: items ? rawCount(json) : 0, pageSize: feed.pageSize }
}

function feedResult(mode, { items, count, pageSize }, page, total) {
  const kept = items.slice(0, Math.max(0, LIMITS.maxProducts - total))
  const newTotal = total + kept.length
  const hasMore = count >= pageSize
  const capped = newTotal >= LIMITS.maxProducts || page >= LIMITS.maxListingPages
  return {
    platform: mode,
    items: kept,
    limitReached: kept.length < items.length || (hasMore && capped),
    cursor: hasMore && !capped ? { mode, page: page + 1, total: newTotal } : null,
  }
}

// ---- generic html pages ----

function htmlResult({ items, queue, listingNext, pages, total }, source) {
  const kept = items.slice(0, Math.max(0, LIMITS.maxProducts - total))
  const newTotal = total + kept.length
  const capped = newTotal >= LIMITS.maxProducts
  const nextUrl = pages >= LIMITS.maxListingPages ? null : sameSiteUrl(listingNext, source)
  const safeQueue = sameSiteList(queue, source, LIMITS.maxProducts - newTotal)
  const hasWork = safeQueue.length > 0 || Boolean(nextUrl)
  return {
    platform: 'page',
    items: kept,
    limitReached: capped
      ? kept.length < items.length || hasWork
      : Boolean(listingNext) && !nextUrl,
    cursor: capped || !hasWork ? null : { mode: 'html', queue: safeQueue, listingNext: nextUrl, pages, total: newTotal },
  }
}

// A listing page either embeds several products itself or links to product pages that are fetched in later steps.
function absorbListing(page, pagesDone, total, source) {
  const embedded = productsFromHtml(page.text, page.url)
  const found = findNextPageUrl(page.text, page.url)
  const next = found && found !== page.url ? found : null
  if (embedded.length > 1) return htmlResult({ items: embedded, queue: [], listingNext: next, pages: pagesDone, total }, source)
  return htmlResult({ items: [], queue: findProductLinks(page.text, page.url), listingNext: next, pages: pagesDone, total }, source)
}

async function startHtml(source, opts) {
  const page = await fetchText(source.href, opts)
  const embedded = productsFromHtml(page.text, page.url)
  const links = findProductLinks(page.text, page.url)
  if (embedded.length === 1 && (looksLikeProductUrl(page.url) || links.length === 0)) {
    return htmlResult({ items: embedded, queue: [], listingNext: null, pages: 1, total: 0 }, source)
  }
  if (embedded.length === 0 && links.length === 0) throw new ImportError(NO_DATA_MESSAGE, 422)
  return absorbListing(page, 1, 0, source)
}

async function htmlStep(cursor, source, opts) {
  if (cursor.queue.length) {
    const batch = cursor.queue.slice(0, LIMITS.productFetchesPerStep)
    const pages = await Promise.all(batch.map((url) => fetchText(url, opts).catch(() => null)))
    return htmlResult({
      items: pages.flatMap((page) => (page ? productsFromHtml(page.text, page.url).slice(0, 1) : [])),
      queue: cursor.queue.slice(batch.length),
      listingNext: cursor.listingNext,
      pages: cursor.pages,
      total: cursor.total,
    }, source)
  }
  if (!cursor.listingNext) return htmlResult({ items: [], queue: [], listingNext: null, pages: cursor.pages, total: cursor.total }, source)
  const page = await fetchText(cursor.listingNext, opts)
  return absorbListing(page, cursor.pages + 1, cursor.total, source)
}

// Stored cursors are untrusted input: rebuild them from validated fields only.
function readCursor(cursor, source) {
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) throw staleScan()
  const total = boundedInt(cursor.total, 0, LIMITS.maxProducts)
  if (total === null) throw staleScan()
  if (cursor.mode === 'html') {
    const pages = boundedInt(cursor.pages, 1, LIMITS.maxListingPages)
    if (pages === null) throw staleScan()
    const listingNext = cursor.listingNext == null ? null : sameSiteUrl(cursor.listingNext, source)
    return { mode: 'html', queue: sameSiteList(cursor.queue, source, LIMITS.maxProducts), listingNext, pages, total }
  }
  if (Object.hasOwn(FEEDS, cursor.mode)) {
    const page = boundedInt(cursor.page, 1, LIMITS.maxListingPages)
    if (page === null) throw staleScan()
    return { mode: cursor.mode, page, total }
  }
  throw staleScan()
}

// One step of a scan (one network round of work, sized for a serverless time limit).
// `cursor` is null for the first call; the returned cursor is null when the scan is finished.
export async function scanStep({ url, cursor = null }, opts = {}) {
  let source
  try {
    source = new URL(url)
  } catch {
    throw new ImportError('Enter a valid website address.', 400)
  }
  if (cursor === null || cursor === undefined) {
    for (const mode of Object.keys(FEEDS)) {
      const feed = await readFeed(mode, source, 1, opts)
      if (feed.items?.length) return feedResult(mode, feed, 1, 0)
    }
    return startHtml(source, opts)
  }
  const state = readCursor(cursor, source)
  if (state.mode === 'html') return htmlStep(state, source, opts)
  const feed = await readFeed(state.mode, source, state.page, opts)
  if (!feed.items) throw new ImportError('The website stopped returning products part-way through the scan.', 502)
  return feedResult(state.mode, feed, state.page, state.total)
}
