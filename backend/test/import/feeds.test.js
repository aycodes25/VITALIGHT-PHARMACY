import { describe, expect, it } from 'vitest'
import { parseShopifyProducts, shopifyFeedUrl } from '../../lib/import/shopify.js'
import { parseWooProducts, wooFeedUrl } from '../../lib/import/woocommerce.js'
import { makeItem } from '../../lib/import/normalize.js'

describe('makeItem', () => {
  it('drops items without a usable name and ignores a "was" price that is not higher', () => {
    expect(makeItem({ name: ' ', sourceUrl: 'https://a.example/' })).toBeNull()
    const item = makeItem({ name: 'Zinc', price: '500', oldPrice: '400', images: ['/a.jpg', '/a.jpg', 'ftp://x/y.jpg'], sourceUrl: 'https://a.example/p' })
    expect(item.old_price).toBeNull()
    expect(item.images).toEqual(['https://a.example/a.jpg'])
  })
})

describe('shopify', () => {
  it('builds feed urls for the whole shop and for a collection', () => {
    expect(shopifyFeedUrl('https://shop.example/', 2)).toBe('https://shop.example/products.json?limit=250&page=2')
    expect(shopifyFeedUrl('https://shop.example/collections/vitamins?sort=x', 1))
      .toBe('https://shop.example/collections/vitamins/products.json?limit=250&page=1')
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
    expect(wooFeedUrl('https://shop.example/shop/', 3)).toBe('https://shop.example/wp-json/wc/store/v1/products?per_page=100&page=3')
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
