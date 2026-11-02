import { describe, expect, it } from 'vitest'
import { extractJsonLdItemUrls, extractJsonLdProducts } from '../../lib/import/jsonld.js'
import { extractMetaProduct } from '../../lib/import/meta.js'
import { findNextPageUrl, findProductLinks, looksLikeProductUrl } from '../../lib/import/links.js'

const ld = (data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`
const PAGE = 'https://shop.example/products/omega-3'

describe('extractJsonLdProducts', () => {
  it('reads a Product with offers, image objects and brand', () => {
    const html = ld({
      '@context': 'https://schema.org', '@type': 'Product', name: 'Omega 3', description: 'Fish oil',
      image: ['/img/o1.jpg', { '@type': 'ImageObject', url: 'https://shop.example/img/o2.jpg' }],
      brand: { '@type': 'Brand', name: 'Seven Seas' }, category: 'Supplements',
      offers: { '@type': 'Offer', price: '9,500.00', priceCurrency: 'NGN' },
    })
    expect(extractJsonLdProducts(html, PAGE)).toEqual([{
      name: 'Omega 3', description: 'Fish oil', price: 9500, old_price: null, currency: 'NGN',
      images: ['https://shop.example/img/o1.jpg', 'https://shop.example/img/o2.jpg'],
      source_url: PAGE, source_category: 'Supplements', brand: 'Seven Seas',
    }])
  })

  it('finds Products inside @graph and ignores other nodes and invalid blocks', () => {
    const html = `${ld({ '@graph': [{ '@type': 'WebSite', name: 'Shop' }, { '@type': 'Product', name: 'Zinc', offers: { price: 500 } }] })}
      <script type="application/ld+json">{ not json</script>`
    const items = extractJsonLdProducts(html, PAGE)
    expect(items.map((item) => item.name)).toEqual(['Zinc'])
    expect(items[0].price).toBe(500)
  })

  it('reads prices from a ProductGroup first variant', () => {
    const html = ld({ '@type': 'ProductGroup', name: 'Multivitamin', hasVariant: [{ '@type': 'Product', offers: { price: '8500', priceCurrency: 'NGN' } }] })
    const [item] = extractJsonLdProducts(html, PAGE)
    expect(item).toMatchObject({ name: 'Multivitamin', price: 8500, currency: 'NGN' })
  })

  it('uses the product url when the Product has one', () => {
    const html = ld({ '@type': 'Product', name: 'Zinc', url: '/products/zinc', offers: { price: 500 } })
    expect(extractJsonLdProducts(html, 'https://shop.example/collections/all')[0].source_url).toBe('https://shop.example/products/zinc')
  })
})

describe('extractJsonLdItemUrls', () => {
  it('collects ItemList urls', () => {
    const html = ld({ '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', url: '/products/a' }, { '@type': 'ListItem', item: { '@id': 'https://shop.example/x/b' } }] })
    expect(extractJsonLdItemUrls(html, 'https://shop.example/collections/all')).toEqual([
      'https://shop.example/products/a',
      'https://shop.example/x/b',
    ])
  })
})

describe('extractMetaProduct', () => {
  it('reads OpenGraph product tags in either attribute order', () => {
    const html = `<meta property="og:type" content="product"><meta content="Vitamin D &amp; K" property="og:title">
      <meta property="product:price:amount" content="4,200"><meta property="product:price:currency" content="NGN">
      <meta property="og:image" content="/img/d.jpg"><meta property="og:description" content="Daily dose">`
    expect(extractMetaProduct(html, PAGE)).toMatchObject({ name: 'Vitamin D & K', price: 4200, currency: 'NGN', images: ['https://shop.example/img/d.jpg'] })
  })

  it('returns null when there is no price or product type', () => {
    expect(extractMetaProduct('<meta property="og:title" content="About us">', PAGE)).toBeNull()
  })
})

describe('findProductLinks', () => {
  it('keeps same-site product links, removes duplicates, variants and the page itself', () => {
    const html = `<a href="/products/vitamin-c">a</a><a href="/products/vitamin-c?variant=2">dup</a>
      <a href="/products/zinc#reviews">b</a><a href="/collections/all">no</a>
      <a href="https://other.example/products/x">other</a><a href="/product-category/foo">no</a>
      <a href="mailto:a@b.c">mail</a><a href="/products/omega-3">self</a>`
    expect(findProductLinks(html, PAGE)).toEqual([
      'https://shop.example/products/vitamin-c',
      'https://shop.example/products/zinc',
    ])
  })

  it('trusts ItemList urls even without a product-looking path', () => {
    const html = ld({ '@type': 'ItemList', itemListElement: [{ url: '/x/b' }] })
    expect(findProductLinks(html, 'https://shop.example/collections/all')).toEqual(['https://shop.example/x/b'])
  })

  it('honours the limit', () => {
    const html = Array.from({ length: 5 }, (_, i) => `<a href="/products/p${i}">x</a>`).join('')
    expect(findProductLinks(html, 'https://shop.example/', { limit: 3 })).toHaveLength(3)
  })
})

describe('findNextPageUrl', () => {
  it('follows rel=next', () => {
    expect(findNextPageUrl('<link rel="next" href="/collections/all?page=2">', 'https://shop.example/collections/all'))
      .toBe('https://shop.example/collections/all?page=2')
  })

  it('falls back to the next page number', () => {
    const html = '<a href="/shop?page=1">1</a><a href="/shop?page=3">3</a>'
    expect(findNextPageUrl(html, 'https://shop.example/shop?page=2')).toBe('https://shop.example/shop?page=3')
  })

  it('returns null on the last page', () => {
    expect(findNextPageUrl('<a href="/shop?page=1">1</a>', 'https://shop.example/shop?page=2')).toBeNull()
  })
})

describe('looksLikeProductUrl', () => {
  it('matches product paths only', () => {
    expect(looksLikeProductUrl('https://shop.example/products/zinc')).toBe(true)
    expect(looksLikeProductUrl('https://shop.example/collections/all')).toBe(false)
  })
})

describe('hostile input never throws', () => {
  const junk = [undefined, null, 42, {}, [], ['<a href="/products/x">'], Symbol.iterator.toString()]

  it('tolerates non-string html and bad page urls everywhere', () => {
    for (const bad of junk) {
      expect(extractJsonLdProducts(bad, PAGE)).toEqual([])
      expect(extractJsonLdItemUrls(bad, PAGE)).toEqual([])
      expect(extractMetaProduct(bad, PAGE)).toBeNull()
      expect(findProductLinks(bad, PAGE)).toEqual([])
      expect(findNextPageUrl(bad, PAGE)).toBeNull()
    }
    for (const badUrl of [undefined, null, 5, '', 'not a url', 'http://', 'javascript:alert(1)', {}]) {
      expect(findProductLinks('<a href="/products/x">x</a>', badUrl)).toEqual([])
      expect(findNextPageUrl('<link rel="next" href="/p?page=2">', badUrl)).toBeNull()
      expect(looksLikeProductUrl(badUrl)).toBe(false)
      expect(() => extractJsonLdProducts(ld({ '@type': 'Product', name: 'Zinc', image: '/a.jpg' }), badUrl)).not.toThrow()
      expect(() => extractMetaProduct('<meta property="product:price:amount" content="5"><title>Zinc</title>', badUrl)).not.toThrow()
    }
  })

  it('survives JSON-LD with primitives and wrong-typed fields', () => {
    const blocks = ['null', '42', '"str"', 'true', '[null,1,"x",[[]]]', '{}']
    const html = blocks.map((b) => `<script type="application/ld+json">${b}</script>`).join('')
    expect(extractJsonLdProducts(html, PAGE)).toEqual([])
    expect(extractJsonLdItemUrls(html, PAGE)).toEqual([])

    const weird = ld({
      '@type': ['Product', 7, null],
      name: ['Zinc', 'Tabs'],
      description: { a: 1 },
      image: [null, 5, { url: 7 }, [['/x.jpg']], { contentUrl: '/ok.jpg' }],
      brand: [null], category: [{ name: 7 }],
      url: { href: 'x' },
      offers: [null, 'cheap', { offers: 'nope' }, { price: { amount: 5 }, priceCurrency: 5 }],
    })
    expect(() => extractJsonLdProducts(weird, PAGE)).not.toThrow()
    expect(extractJsonLdProducts(weird, PAGE)).toEqual([])

    const named = ld({ '@type': 'Product', name: 'Zinc', offers: { price: [1, 2], priceSpecification: ['x'] }, hasVariant: 'abc', brand: 5, category: null })
    expect(extractJsonLdProducts(named, PAGE)).toMatchObject([{ name: 'Zinc', price: null, brand: '' }])

    const group = ld({ '@type': 'ProductGroup', name: 'Group', hasVariant: 'abc' })
    expect(extractJsonLdProducts(group, PAGE)).toMatchObject([{ name: 'Group', price: null }])
    const group2 = ld({ '@type': 'ProductGroup', name: 'Group', hasVariant: { offers: 7 }, offers: { price: 3 } })
    expect(() => extractJsonLdProducts(group2, PAGE)).not.toThrow()
  })

  it('survives odd ListItem shapes', () => {
    const html = ld({ '@type': 'ItemList', itemListElement: [null, 5, 'x', { item: 7 }, { item: null }, { url: {} }, { url: '/products/ok' }, { item: 'https://shop.example/products/s' }] })
    expect(extractJsonLdItemUrls(html, PAGE)).toEqual(['https://shop.example/products/ok', 'https://shop.example/products/s'])
  })

  it('survives deeply nested JSON-LD', () => {
    const depth = 20000
    const deep = `<script type="application/ld+json">${'['.repeat(depth)}${']'.repeat(depth)}</script>`
    const deepObj = `<script type="application/ld+json">${'{"@graph":'.repeat(3000)}{"@type":"Product","name":"Deep"}${'}'.repeat(3000)}</script>`
    expect(() => extractJsonLdProducts(deep + deepObj, PAGE)).not.toThrow()
    expect(() => extractJsonLdItemUrls(deep + deepObj, PAGE)).not.toThrow()
    expect(extractJsonLdProducts(deepObj, PAGE)).toEqual([])
  })

  it('caps work on huge input', () => {
    const many = Array.from({ length: 2000 }, (_, i) => ({ '@type': 'Product', name: `Item ${i}` }))
    expect(extractJsonLdProducts(ld(many), PAGE).length).toBeLessThanOrEqual(500)
    const links = Array.from({ length: 5000 }, (_, i) => `<a href="/products/p${i}">x</a>`).join('')
    expect(findProductLinks(links, PAGE, { limit: 10 })).toHaveLength(10)
    expect(findProductLinks(links, PAGE, { limit: -1 }).length).toBeLessThanOrEqual(200)
    expect(findProductLinks(links, PAGE, { limit: NaN }).length).toBe(200)
  })

  it('ignores malformed hrefs and unsafe schemes', () => {
    const html = `<a href="http://[bad">x</a><a href="https://">y</a><a href="javascript:alert(1)">z</a>
      <a href="//">w</a><a href="data:text/html,x">d</a><a href='/products/ok'>ok</a><a href="">e</a><a href>f</a>`
    expect(findProductLinks(html, PAGE)).toEqual(['https://shop.example/products/ok'])
    expect(findNextPageUrl('<link rel="next" href="http://[bad"><a rel="next" href="javascript:x">n</a>', PAGE)).toBeNull()
  })

  it('reads meta values containing the other quote type', () => {
    const html = `<meta property="og:title" content="Men's Vitamin"><meta property='product:price:amount' content='1,000'>`
    expect(extractMetaProduct(html, PAGE)).toMatchObject({ name: "Men's Vitamin", price: 1000 })
  })
})

describe('hostile html is scanned in linear time', () => {
  const LIMIT_MS = 500
  const cases = {
    'unterminated ld+json scripts': '<script type="application/ld+json">'.repeat(25000),
    'script starts without >': '<script '.repeat(150000),
    'anchor starts without >': '<a '.repeat(300000),
    'meta starts without >': '<meta '.repeat(200000),
    'link starts without >': '<link '.repeat(200000),
    'title starts without >': '<title '.repeat(150000),
  }

  for (const [label, html] of Object.entries(cases)) {
    it(`returns quickly for ${label}`, { timeout: 20000 }, () => {
      const started = performance.now()
      extractJsonLdProducts(html, PAGE)
      extractJsonLdItemUrls(html, PAGE)
      extractMetaProduct(html, PAGE)
      findProductLinks(html, PAGE)
      findNextPageUrl(html, PAGE)
      expect(performance.now() - started).toBeLessThan(LIMIT_MS)
    })
  }

  it('still extracts a valid block that precedes unterminated junk', { timeout: 20000 }, () => {
    const html = ld({ '@type': 'Product', name: 'Zinc', offers: { price: 500 } }) + '<script type="application/ld+json">'.repeat(25000)
    const started = performance.now()
    const items = extractJsonLdProducts(html, PAGE)
    expect(performance.now() - started).toBeLessThan(LIMIT_MS)
    expect(items.map((item) => item.name)).toEqual(['Zinc'])
  })

  it('extracts two valid blocks separated by normal html, case-insensitively', () => {
    const html = `${ld({ '@type': 'Product', name: 'Zinc' })}<div><p>hi</p></div>
      <SCRIPT TYPE='application/LD+JSON'>${JSON.stringify({ '@type': 'Product', name: 'Iron' })}</SCRIPT>`
    expect(extractJsonLdProducts(html, PAGE).map((item) => item.name)).toEqual(['Zinc', 'Iron'])
  })
})
