import { describe, expect, it } from 'vitest'
import { parseShopifyProducts, shopifyFeedUrl } from '../../lib/import/shopify.js'
import { parseWooProducts, wooFeedUrl } from '../../lib/import/woocommerce.js'
import { decodeEntities, makeItem } from '../../lib/import/normalize.js'

describe('makeItem', () => {
  it('drops items without a usable name and ignores a "was" price that is not higher', () => {
    expect(makeItem({ name: ' ', sourceUrl: 'https://a.example/' })).toBeNull()
    const item = makeItem({ name: 'Zinc', price: '500', oldPrice: '400', images: ['/a.jpg', '/a.jpg', 'ftp://x/y.jpg'], sourceUrl: 'https://a.example/p' })
    expect(item.old_price).toBeNull()
    expect(item.images).toEqual(['https://a.example/a.jpg'])
  })
})

describe('makeItem image urls', () => {
  it('drops image urls longer than 2000 characters', () => {
    const item = makeItem({ name: 'Zinc', images: [`https://a.example/${'x'.repeat(2000)}.jpg`, 'https://a.example/ok.jpg'], sourceUrl: 'https://a.example/p' })
    expect(item.images).toEqual(['https://a.example/ok.jpg'])
  })
})

describe('shopify', () => {
  it('builds feed urls for the whole shop and for a collection', () => {
    expect(shopifyFeedUrl('https://shop.example/', 2)).toBe('https://shop.example/products.json?limit=50&page=2')
    expect(shopifyFeedUrl('https://shop.example/collections/vitamins?sort=x', 1))
      .toBe('https://shop.example/collections/vitamins/products.json?limit=50&page=1')
  })

  it('uses the whole-shop feed for non-collection pages and none for a product page', () => {
    expect(shopifyFeedUrl('https://shop.example/pages/about', 1)).toBe('https://shop.example/products.json?limit=50&page=1')
    expect(shopifyFeedUrl('https://shop.example/en-ng/collections/vitamins/', 2)).toBe('https://shop.example/en-ng/collections/vitamins/products.json?limit=50&page=2')
    expect(shopifyFeedUrl('https://shop.example/products/zinc', 1)).toBeNull()
    expect(shopifyFeedUrl('https://shop.example/collections/vitamins/products/zinc', 1)).toBeNull()
  })

  it('maps products and skips unnamed ones', () => {
    const json = {
      products: [
        {
          title: 'Vitamin C 1000mg', handle: 'vitamin-c', body_html: '<p>Immune <b>support</b> &amp; more</p>',
          vendor: 'Nature', product_type: 'Vitamins',
          variants: [{ price: '6200.00', compare_at_price: '7000.00' }],
          images: [{ src: 'https://cdn.example/a.jpg' }, { src: 'https://cdn.example/b.jpg' }],
        },
        { title: '', handle: 'x', variants: [] },
      ],
    }
    expect(parseShopifyProducts(json, 'https://shop.example')).toEqual([{
      name: 'Vitamin C 1000mg',
      description: 'Immune support & more',
      price: 6200,
      old_price: 7000,
      currency: '',
      images: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
      source_url: 'https://shop.example/products/vitamin-c',
      source_category: 'Vitamins',
      brand: 'Nature',
    }])
  })

  it('returns null when the json is not a Shopify feed', () => {
    expect(parseShopifyProducts({ hello: 1 }, 'https://shop.example')).toBeNull()
    expect(parseShopifyProducts(null, 'https://shop.example')).toBeNull()
  })
})

describe('woocommerce', () => {
  it('builds the store api url', () => {
    expect(wooFeedUrl('https://shop.example/shop/', 3)).toBe('https://shop.example/wp-json/wc/store/v1/products?per_page=50&page=3')
    expect(wooFeedUrl('https://shop.example/en/shop', 1)).toBe('https://shop.example/wp-json/wc/store/v1/products?per_page=50&page=1')
    expect(wooFeedUrl('https://shop.example/product-category/vitamins/', 2)).toBe('https://shop.example/wp-json/wc/store/v1/products?per_page=50&page=2&category=vitamins')
    expect(wooFeedUrl('https://shop.example/product-category/health/vitamins', 1)).toMatch(/&category=vitamins$/)
    expect(wooFeedUrl('https://shop.example/product/zinc', 1)).toBeNull()
    expect(wooFeedUrl('https://shop.example/about', 1)).toBeNull()
  })

  it('converts minor-unit prices and reads sale prices', () => {
    const json = [{
      name: 'Hand Sanitizer', permalink: 'https://shop.example/product/hand-sanitizer/',
      short_description: '<p>500ml</p>',
      prices: { price: '450000', regular_price: '500000', currency_code: 'NGN', currency_minor_unit: 2 },
      images: [{ src: 'https://shop.example/a.jpg' }],
      categories: [{ name: 'Personal care' }],
    }]
    expect(parseWooProducts(json, 'https://shop.example')).toEqual([{
      name: 'Hand Sanitizer', description: '500ml', price: 4500, old_price: 5000, currency: 'NGN',
      images: ['https://shop.example/a.jpg'], source_url: 'https://shop.example/product/hand-sanitizer/',
      source_category: 'Personal care', brand: '',
    }])
  })

  it('returns null for non-Woo json and an empty list for an empty page', () => {
    expect(parseWooProducts({ products: [] }, 'https://shop.example')).toBeNull()
    expect(parseWooProducts([], 'https://shop.example')).toEqual([])
  })
})

describe('hostile data', () => {
  it('shopify skips bad entries, tolerates non-array variants/images, skips missing handle', () => {
    const json = { products: [
      null, 'str', 5,
      { title: 'No Handle', variants: [] },
      { title: 'Odd One', handle: 'odd one', variants: {}, images: { src: 'x' } },
      { title: 'Str Images', handle: 'si', images: 'abc' },
      { title: 'Null Images', handle: 'ni', images: null },
    ] }
    const items = parseShopifyProducts(json, 'https://shop.example')
    expect(items.map((i) => i.name)).toEqual(['Odd One', 'Str Images', 'Null Images'])
    expect(items[0].source_url).toBe('https://shop.example/products/odd%20one')
    expect(items.every((i) => i.images.length === 0)).toBe(true)
  })

  it('woo tolerates non-array images/categories/brands and non-http permalinks', () => {
    const base = { prices: { price: '1000', currency_minor_unit: 2 } }
    const items = parseWooProducts([
      { ...base, name: 'A Product', images: { src: 'x' }, categories: { name: 'c' }, brands: 'b', permalink: 'javascript:alert(1)' },
      { ...base, name: 'B Product', images: null, permalink: 5 },
    ], 'https://shop.example')
    expect(items).toHaveLength(2)
    expect(items[0].source_url).toBe('https://shop.example')
    expect(items[1].source_url).toBe('https://shop.example')
    expect(items[0].images).toEqual([])
  })

  it('makeItem tolerates non-array images and non-string entries', () => {
    for (const images of [{}, 'abc', null, 5]) {
      expect(makeItem({ name: 'Zinc', images, sourceUrl: 'https://a.example/p' }).images).toEqual([])
    }
    expect(makeItem({ name: 'Zinc', images: [null, 5, {}, '/a.jpg'], sourceUrl: 'https://a.example/p' }).images)
      .toEqual(['https://a.example/a.jpg'])
  })

  it('decodes numeric entities once', () => {
    const name = (n) => makeItem({ name: n, sourceUrl: 'https://a.example/' }).name
    expect(name('Men&#039;s')).toBe("Men's")
    expect(name('A&#8211;B')).toBe('A–B')
    expect(name('A&#38;B')).toBe('A&B')
    expect(name('It&#x27;s')).toBe("It's")
    expect(name('x &amp;lt; y')).toBe('x &lt; y')
    expect(name('bad &#99999999; ok')).toBe('bad &#99999999; ok')
  })
})

describe('decodeEntities', () => {
  it.each(['&#0;', '&#x0;', '&#00000;', '&#xD800;', '&#55357;', '&#7;', '&#x85;'])(
    'leaves %s unchanged (NUL, lone surrogate, or control character)',
    (entity) => expect(decodeEntities(entity)).toBe(entity),
  )

  it('still decodes tab, newline, carriage return and apostrophe entities', () => {
    expect(decodeEntities('&#9;')).toBe('\t')
    expect(decodeEntities('&#10;')).toBe('\n')
    expect(decodeEntities('&#13;')).toBe('\r')
    expect(decodeEntities('&#039;')).toBe("'")
  })
})
