import { describe, expect, it } from 'vitest'
import { LIMITS, scanStep } from '../../lib/import/scanner.js'
import { ImportError } from '../../lib/import/urlSafety.js'
import { fakeFetch, publicLookup } from '../helpers/fakeFetch.js'

const ld = (data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`
const product = (name, price = 1000) => ld({ '@type': 'Product', name, offers: { price, priceCurrency: 'NGN' } })
const run = (routes) => {
  const { fetchImpl } = fakeFetch(routes)
  return { fetchImpl, lookup: publicLookup }
}
const wooRaw = (count, offset = 0) => Array.from({ length: count }, (_, i) => ({
  name: `Item ${offset + i}`, permalink: `https://shop.example/product/${offset + i}`,
  prices: { price: '100000', regular_price: '100000', currency_code: 'NGN', currency_minor_unit: 2 }, images: [], categories: [],
}))

describe('scanStep: feeds', () => {
  it('reads a Shopify feed in one step', async () => {
    const opts = run({ 'https://shop.example/products.json?limit=250&page=1': { products: [
      { title: 'Item A', handle: 'a', variants: [{ price: '100' }], images: [] },
      { title: 'Item B', handle: 'b', variants: [{ price: '200' }], images: [] },
    ] } })
    const step = await scanStep({ url: 'https://shop.example/' }, opts)
    expect(step.platform).toBe('shopify')
    expect(step.items.map((item) => item.name)).toEqual(['Item A', 'Item B'])
    expect(step.cursor).toBeNull()
    expect(step.limitReached).toBe(false)
  })

  it('caps a large Shopify feed at the product limit', async () => {
    const products = Array.from({ length: 250 }, (_, i) => ({ title: `P${i}`, handle: `p${i}`, variants: [{ price: '1' }], images: [] }))
    const opts = run({ 'https://shop.example/products.json?limit=250&page=1': { products } })
    const step = await scanStep({ url: 'https://shop.example/' }, opts)
    expect(step.items).toHaveLength(LIMITS.maxProducts)
    expect(step.cursor).toBeNull()
    expect(step.limitReached).toBe(true)
  })

  it('pages through the WooCommerce store api', async () => {
    const opts = run({
      'https://shop.example/wp-json/wc/store/v1/products?per_page=100&page=1': wooRaw(100),
      'https://shop.example/wp-json/wc/store/v1/products?per_page=100&page=2': wooRaw(30, 100),
    })
    const first = await scanStep({ url: 'https://shop.example/' }, opts)
    expect(first.platform).toBe('woocommerce')
    expect(first.items).toHaveLength(100)
    expect(first.cursor).toEqual({ mode: 'woocommerce', page: 2, total: 100 })

    const second = await scanStep({ url: 'https://shop.example/', cursor: first.cursor }, opts)
    expect(second.items).toHaveLength(30)
    expect(second.cursor).toBeNull()
  })
})

describe('scanStep: html pages', () => {
  it('reads a single product page', async () => {
    const opts = run({ 'https://shop.example/products/omega-3': `<html>${product('Omega 3', 9500)}</html>` })
    const step = await scanStep({ url: 'https://shop.example/products/omega-3' }, opts)
    expect(step.platform).toBe('page')
    expect(step.items.map((item) => item.name)).toEqual(['Omega 3'])
    expect(step.cursor).toBeNull()
  })

  it('reads a listing page that embeds several products', async () => {
    const html = `${ld({ '@type': 'ItemList', itemListElement: [] })}${product('Item A')}${product('Item B')}`
    const step = await scanStep({ url: 'https://shop.example/shop' }, run({ 'https://shop.example/shop': html }))
    expect(step.items.map((item) => item.name)).toEqual(['Item A', 'Item B'])
    expect(step.cursor).toBeNull()
  })

  it('queues product links, fetches them in steps and follows the next listing page', async () => {
    const opts = run({
      'https://shop.example/shop': '<link rel="next" href="/shop?page=2"><a href="/products/a">a</a><a href="/products/b">b</a>',
      'https://shop.example/products/a': product('Item A'),
      'https://shop.example/products/b': product('Item B'),
      'https://shop.example/shop?page=2': '<a href="/products/c">c</a>',
      'https://shop.example/products/c': product('Item C'),
    })
    const start = await scanStep({ url: 'https://shop.example/shop' }, opts)
    expect(start.items).toEqual([])
    expect(start.cursor).toEqual({
      mode: 'html', queue: ['https://shop.example/products/a', 'https://shop.example/products/b'],
      listingNext: 'https://shop.example/shop?page=2', pages: 1, total: 0,
    })

    const products = await scanStep({ url: 'https://shop.example/shop', cursor: start.cursor }, opts)
    expect(products.items.map((item) => item.name)).toEqual(['Item A', 'Item B'])
    expect(products.cursor).toMatchObject({ queue: [], listingNext: 'https://shop.example/shop?page=2', total: 2 })

    const listing = await scanStep({ url: 'https://shop.example/shop', cursor: products.cursor }, opts)
    expect(listing.items).toEqual([])
    expect(listing.cursor).toMatchObject({ queue: ['https://shop.example/products/c'], listingNext: null, pages: 2 })

    const last = await scanStep({ url: 'https://shop.example/shop', cursor: listing.cursor }, opts)
    expect(last.items.map((item) => item.name)).toEqual(['Item C'])
    expect(last.cursor).toBeNull()
  })

  it('skips product pages that cannot be read', async () => {
    const opts = run({ 'https://shop.example/products/a': product('Item A') })
    const cursor = { mode: 'html', queue: ['https://shop.example/products/a', 'https://shop.example/products/gone'], listingNext: null, pages: 1, total: 0 }
    const step = await scanStep({ url: 'https://shop.example/shop', cursor }, opts)
    expect(step.items.map((item) => item.name)).toEqual(['Item A'])
    expect(step.cursor).toBeNull()
  })

  it('stops at the product limit', async () => {
    const opts = run({
      'https://shop.example/products/a': product('Item A'), 'https://shop.example/products/b': product('Item B'), 'https://shop.example/products/c': product('Item C'),
    })
    const cursor = {
      mode: 'html', total: LIMITS.maxProducts - 1, pages: 1, listingNext: null,
      queue: ['https://shop.example/products/a', 'https://shop.example/products/b', 'https://shop.example/products/c'],
    }
    const step = await scanStep({ url: 'https://shop.example/shop', cursor }, opts)
    expect(step.items).toHaveLength(1)
    expect(step.cursor).toBeNull()
    expect(step.limitReached).toBe(true)
  })

  it('explains when a site exposes no readable product data', async () => {
    const opts = run({ 'https://shop.example/': '<html><body>Welcome</body></html>' })
    await expect(scanStep({ url: 'https://shop.example/' }, opts)).rejects.toMatchObject({ status: 422 })
    await expect(scanStep({ url: 'https://shop.example/' }, opts)).rejects.toBeInstanceOf(ImportError)
  })

  it('rejects scan state it does not recognise', async () => {
    await expect(scanStep({ url: 'https://shop.example/', cursor: { mode: 'other' } }, run({}))).rejects.toThrow(/Start a new scan/)
  })
})

describe('scanStep: hostile sites and tampered cursors', () => {
  const shop = 'https://shop.example/shop'

  it('keeps the stored queue bounded and same-site', async () => {
    const links = Array.from({ length: 500 }, (_, i) => `<a href="/products/p${i}">p</a>`).join('')
    const foreign = '<a href="https://evil.example/products/x">x</a>'
    const step = await scanStep({ url: shop }, run({ [shop]: foreign + links }))
    expect(step.cursor.queue.length).toBeLessThanOrEqual(LIMITS.maxProducts)
    expect(step.cursor.queue.every((u) => u.startsWith('https://shop.example/'))).toBe(true)
    expect(step.limitReached).toBe(true)
  })

  it('drops stored urls longer than 512 characters', async () => {
    const long = `https://shop.example/products/${'x'.repeat(520)}`
    const opts = run({ 'https://shop.example/products/a': product('Item A') })
    const queue = [long, 'https://shop.example/products/a']
    const step = await scanStep({ url: shop, cursor: { mode: 'html', queue, listingNext: null, pages: 1, total: 0 } }, opts)
    expect(step.items.map((item) => item.name)).toEqual(['Item A'])
    const links = `<a href="/products/${'y'.repeat(520)}">y</a><a href="/products/ok">ok</a>`
    const start = await scanStep({ url: shop }, run({ [shop]: links }))
    expect(start.cursor.queue).toEqual(['https://shop.example/products/ok'])
  })

  it('does not queue or fetch the same product url twice', async () => {
    const { fetchImpl, calls } = fakeFetch({ 'https://shop.example/products/a': product('Item A') })
    const opts = { fetchImpl, lookup: publicLookup }
    const queue = ['https://shop.example/products/a', 'https://shop.example/products/a', 'https://shop.example/products/a/']
    const step = await scanStep({ url: shop, cursor: { mode: 'html', queue, listingNext: null, pages: 1, total: 0 } }, opts)
    expect(step.items).toHaveLength(1)
    expect(calls.filter((c) => c.endsWith('/products/a') || c.endsWith('/products/a/'))).toHaveLength(1)

    const html = '<a href="/products/a">a</a><a href="/products/a/">a</a><a href="/products/a#x">a</a><a href="/products/b">b</a>'
    const start = await scanStep({ url: shop }, run({ [shop]: html }))
    expect(start.cursor.queue).toEqual(['https://shop.example/products/a', 'https://shop.example/products/b'])
  })

  it('stops following listing pages once the page budget is used', async () => {
    const { fetchImpl, calls } = fakeFetch({})
    const cursor = { mode: 'html', queue: [], listingNext: 'https://shop.example/shop?page=21', pages: LIMITS.maxListingPages, total: 0 }
    const step = await scanStep({ url: shop, cursor }, { fetchImpl, lookup: publicLookup })
    expect(calls).toEqual([])
    expect(step.cursor).toBeNull()
    expect(step.limitReached).toBe(true)
  })

  it('follows a www / non-www redirect but refuses a redirect to another site', async () => {
    const redirectTo = (from, to, routes = {}) => async (input) => {
      const key = String(input)
      if (key === from) return new Response(null, { status: 301, headers: { location: to } })
      const hit = routes[key]
      return hit === undefined ? new Response('nf', { status: 404 }) : new Response(hit, { status: 200, headers: { 'content-type': 'text/html' } })
    }
    const page = '<a href="/products/a">a</a>'
    const same = { fetchImpl: redirectTo('https://shop.example/shop', 'https://www.shop.example/shop', { 'https://www.shop.example/shop': page }), lookup: publicLookup }
    const ok = await scanStep({ url: shop }, same)
    expect(ok.cursor.queue).toEqual(['https://www.shop.example/products/a'])

    const other = { fetchImpl: redirectTo('https://shop.example/shop', 'https://other.example/shop', { 'https://other.example/shop': page }), lookup: publicLookup }
    await expect(scanStep({ url: shop }, other)).rejects.toMatchObject({ status: 422, message: 'The website redirected to a different address. Paste the final address instead.' })
  })

  it('drops foreign or non-http listingNext values', async () => {
    const opts = run({ 'https://shop.example/products/a': product('Item A') })
    for (const listingNext of ['https://evil.example/shop?page=2', 'javascript:alert(1)', 'file:///etc/passwd', 42, {}]) {
      const cursor = { mode: 'html', queue: ['https://shop.example/products/a'], listingNext, pages: 1, total: 0 }
      const step = await scanStep({ url: shop, cursor }, opts)
      expect(step.items.map((item) => item.name)).toEqual(['Item A'])
      expect(step.cursor).toBeNull()
    }
  })

  it('ignores foreign, non-string and non-http queue entries from a stored cursor', async () => {
    const opts = run({ 'https://shop.example/products/a': product('Item A') })
    const queue = ['https://evil.example/products/x', 'ftp://shop.example/products/y', null, 7, {}, 'https://shop.example/products/a']
    const step = await scanStep({ url: shop, cursor: { mode: 'html', queue, listingNext: null, pages: 1, total: 0 } }, opts)
    expect(step.items.map((item) => item.name)).toEqual(['Item A'])
  })

  it('rejects malformed cursors', async () => {
    const bad = [
      'x', [], { mode: 'html', queue: [], listingNext: null, pages: 1, total: -1 },
      { mode: 'html', queue: [], listingNext: null, pages: 0, total: 0 },
      { mode: 'html', queue: [], listingNext: null, pages: 1, total: 1e9 },
      { mode: 'shopify', page: 1e9, total: 0 }, { mode: 'woocommerce', page: 'a', total: 0 },
      { mode: '__proto__', page: 1, total: 0 }, { mode: 'toString', page: 1, total: 0 },
    ]
    for (const cursor of bad) {
      await expect(scanStep({ url: shop, cursor }, run({}))).rejects.toThrow(/Start a new scan/)
    }
  })

  it('finishes when an html cursor has no work left', async () => {
    const step = await scanStep({ url: shop, cursor: { mode: 'html', queue: [], listingNext: null, pages: 1, total: 0 } }, run({}))
    expect(step.cursor).toBeNull()
  })

  it('does not follow a next link that points back at the same page', async () => {
    const html = '<link rel="next" href="/shop"><a href="/products/a">a</a>'
    const step = await scanStep({ url: shop }, run({ [shop]: html }))
    expect(step.cursor.listingNext).toBeNull()
  })

  it('terminates a listing that always links to a fresh next page', async () => {
    const routes = {}
    for (let i = 1; i <= 60; i += 1) routes[`https://shop.example/shop?page=${i}`] = `<link rel="next" href="/shop?page=${i + 1}"><a href="/products/p${i}">p</a>`
    const opts = run(routes)
    let cursor = null
    let steps = 0
    let limitReached = false
    do {
      const result = await scanStep({ url: 'https://shop.example/shop?page=1', cursor }, opts)
      cursor = result.cursor
      limitReached = limitReached || result.limitReached
      steps += 1
    } while (cursor && steps < 500)
    expect(cursor).toBeNull()
    expect(limitReached).toBe(true)
  })

  it('terminates when a feed answers every page with a full page of products', async () => {
    const routes = {}
    for (let i = 1; i <= 60; i += 1) routes[`https://shop.example/wp-json/wc/store/v1/products?per_page=100&page=${i}`] = wooRaw(100, 0)
    const opts = run(routes)
    let cursor = null
    let steps = 0
    do {
      const result = await scanStep({ url: 'https://shop.example/', cursor }, opts)
      cursor = result.cursor
      steps += 1
    } while (cursor && steps < 500)
    expect(cursor).toBeNull()
    expect(steps).toBeLessThanOrEqual(LIMITS.maxListingPages)
  })

  it('tolerates feeds that return non-object entries or the wrong shape', async () => {
    const shopify = run({ 'https://shop.example/products.json?limit=250&page=1': { products: [null, 1, 'x', [], { handle: 'ok', title: 'Ok', variants: 'bad', images: 7 }] } })
    const step = await scanStep({ url: 'https://shop.example/' }, shopify)
    expect(step.items.map((item) => item.name)).toEqual(['Ok'])

    const woo = run({ 'https://shop.example/wp-json/wc/store/v1/products?per_page=100&page=1': [null, 1, 'x', { prices: null, name: 'Wo' }] })
    const wooStep = await scanStep({ url: 'https://shop.example/' }, woo)
    expect(wooStep.items.map((item) => item.name)).toEqual(['Wo'])
    const odd = run({ 'https://shop.example/products.json?limit=250&page=1': { products: 'nope' }, 'https://shop.example/': '<p>hi</p>' })
    await expect(scanStep({ url: 'https://shop.example/' }, odd)).rejects.toMatchObject({ status: 422 })
  })

  it('rejects an unparseable source url as an ImportError', async () => {
    await expect(scanStep({ url: 'not a url' }, run({}))).rejects.toBeInstanceOf(ImportError)
  })
})

describe('scanStep: same-site matching', () => {
  const queueFor = async (source, entries) => {
    const routes = Object.fromEntries(entries.map((u) => [u.replace(/^(https:\/\/)[^/@]*@/, '$1'), product('Item X')]))
    const cursor = { mode: 'html', queue: entries, listingNext: null, pages: 1, total: 0 }
    const step = await scanStep({ url: source, cursor }, run(routes))
    return step.items.length
  }

  it('rejects look-alike subdomains of the source and accepts www in either direction', async () => {
    expect(await queueFor('https://shop.example/shop', ['https://shop.example.evil.com/products/a'])).toBe(0)
    expect(await queueFor('https://shop.example/shop', ['https://www.shop.example/products/a'])).toBe(1)
    expect(await queueFor('https://www.shop.example/shop', ['https://shop.example/products/a'])).toBe(1)
  })

  it('rejects a different port', async () => {
    expect(await queueFor('https://shop.example/shop', ['https://shop.example:8443/products/a'])).toBe(0)
  })

  it('resolves user@host style urls to the real host', async () => {
    expect(await queueFor('https://shop.example/shop', ['https://shop.example@evil.example/products/a'])).toBe(0)
    expect(await queueFor('https://shop.example/shop', ['https://evil.example@shop.example/products/a'])).toBe(1)
  })
})
