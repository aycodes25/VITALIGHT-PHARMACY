import { extractJsonLdItemUrls } from './jsonld.js'
import { absoluteUrl, decodeEntities, findTags, text } from './normalize.js'

const PRODUCT_PATH = /\/(?:products?|items?)\/[^/?#]+/i
function parseUrl(value) {
  if (typeof value !== 'string') return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

const parseWebUrl = (value) => {
  const url = parseUrl(value)
  return url && (url.protocol === 'http:' || url.protocol === 'https:') ? url : null
}

export const looksLikeProductUrl = (url) => {
  const parsed = parseUrl(url)
  return parsed !== null && PRODUCT_PATH.test(parsed.pathname)
}

const hrefOf = (tag) => decodeEntities(tag.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i)?.slice(1).find(Boolean) ?? '')

export function findProductLinks(rawHtml, pageUrl, { limit = 200 } = {}) {
  const html = text(rawHtml)
  const page = parseWebUrl(pageUrl)
  if (!page) return []
  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 200
  const self = new URL(page.href)
  self.search = ''
  self.hash = ''
  const urls = new Set()

  const add = (href, { trusted = false } = {}) => {
    const url = parseWebUrl(absoluteUrl(href, pageUrl))
    if (!url) return
    if (url.origin !== page.origin || (!trusted && !PRODUCT_PATH.test(url.pathname))) return
    url.search = ''
    url.hash = ''
    if (url.href !== self.href) urls.add(url.href)
  }

  for (const href of extractJsonLdItemUrls(html, pageUrl)) add(href, { trusted: true })
  for (const { tag } of findTags(html, ['a'])) {
    if (urls.size >= max) break
    const href = hrefOf(tag)
    if (href) add(href)
  }
  return [...urls].slice(0, max)
}

const pageNumber = (url) => {
  const raw = url.searchParams.get('page') ?? url.pathname.match(/\/page\/(\d+)\/?$/)?.[1]
  const number = Number(raw)
  return Number.isInteger(number) && number > 0 ? number : null
}
const basePath = (url) => url.pathname.replace(/\/page\/\d+\/?$/, '')

export function findNextPageUrl(rawHtml, pageUrl) {
  const html = text(rawHtml)
  const page = parseWebUrl(pageUrl)
  if (!page) return null
  const tags = [...findTags(html, ['link', 'a'])].map(({ tag }) => tag)

  for (const tag of tags) {
    if (!/\brel\s*=\s*["'][^"']*\bnext\b[^"']*["']/i.test(tag)) continue
    const abs = absoluteUrl(hrefOf(tag), pageUrl)
    const url = parseWebUrl(abs)
    if (url && url.origin === page.origin && abs !== page.href) return abs
  }

  const wanted = (pageNumber(page) ?? 1) + 1
  for (const tag of tags) {
    if (!tag.toLowerCase().startsWith('<a')) continue
    const abs = absoluteUrl(hrefOf(tag), pageUrl)
    const url = parseWebUrl(abs)
    if (!url) continue
    if (url.origin === page.origin && pageNumber(url) === wanted && basePath(url) === basePath(page)) return abs
  }
  return null
}
