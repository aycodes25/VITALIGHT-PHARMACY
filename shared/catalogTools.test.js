import { describe, expect, it } from 'vitest'
import {
  slugify, categorySlug, findCategoryBySlug, isInStock, discountPercent,
  brandsOf, filterProducts, sortProducts, paginate, relatedProducts,
} from './catalogTools.js'

const products = [
  { id: 'p1', name: 'Paracetamol', brand: 'Vitalight', category: 'Medicines & pain relief', detail: '24 tablets', price: 1200, oldPrice: null, stock: 10, featured: true, sort_order: 1 },
  { id: 'p2', name: 'Ibuprofen', brand: 'Vitalight', category: 'Medicines & pain relief', detail: '20 tablets', price: 1800, oldPrice: 2400, stock: 0, featured: false, sort_order: 0 },
  { id: 'p3', name: 'Sunscreen', brand: 'DermaCalm', category: 'Skin care & dermatology', detail: '75 ml', price: 9500, oldPrice: null, stock: 4, featured: false, sort_order: 0 },
]

describe('slugs', () => {
  it('slugifies ampersands and punctuation', () => {
    expect(slugify('Vitamins & supplements')).toBe('vitamins-and-supplements')
    expect(slugify('Cold, flu & allergy')).toBe('cold-flu-and-allergy')
    expect(categorySlug('Mother & baby')).toBe('mother-and-baby')
  })
  it('finds categories by slug', () => {
    const categories = [{ name: 'Mother & baby' }, { name: 'First aid & wound care' }]
    expect(findCategoryBySlug(categories, 'first-aid-and-wound-care').name).toBe('First aid & wound care')
    expect(findCategoryBySlug(categories, 'nope')).toBeNull()
  })
})

describe('product helpers', () => {
  it('isInStock and discountPercent', () => {
    expect(isInStock(products[0])).toBe(true)
    expect(isInStock(products[1])).toBe(false)
    expect(discountPercent(products[1])).toBe(25)
    expect(discountPercent(products[0])).toBe(0)
  })
  it('brandsOf returns unique sorted brands', () => {
    expect(brandsOf(products)).toEqual(['DermaCalm', 'Vitalight'])
  })
})

describe('filterProducts', () => {
  it('filters by category, query, stock, sale, price and brand', () => {
    expect(filterProducts(products, { category: 'Skin care & dermatology' }).map((p) => p.id)).toEqual(['p3'])
    expect(filterProducts(products, { query: 'ibu' }).map((p) => p.id)).toEqual(['p2'])
    expect(filterProducts(products, { inStockOnly: true }).map((p) => p.id)).toEqual(['p1', 'p3'])
    expect(filterProducts(products, { onSaleOnly: true }).map((p) => p.id)).toEqual(['p2'])
    expect(filterProducts(products, { minPrice: 1500, maxPrice: 5000 }).map((p) => p.id)).toEqual(['p2'])
    expect(filterProducts(products, { brands: ['DermaCalm'] }).map((p) => p.id)).toEqual(['p3'])
  })
  it('matches brand and detail text in query', () => {
    expect(filterProducts(products, { query: 'dermacalm' })).toHaveLength(1)
    expect(filterProducts(products, { query: '75 ml' })).toHaveLength(1)
  })
})

describe('sortProducts', () => {
  it('sorts by price, name, discount and featured', () => {
    expect(sortProducts(products, 'price-asc').map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(sortProducts(products, 'price-desc').map((p) => p.id)).toEqual(['p3', 'p2', 'p1'])
    expect(sortProducts(products, 'name').map((p) => p.id)).toEqual(['p2', 'p1', 'p3'])
    expect(sortProducts(products, 'discount')[0].id).toBe('p2')
    expect(sortProducts(products, 'featured')[0].id).toBe('p1')
  })
  it('does not mutate the input', () => {
    const copy = [...products]
    sortProducts(products, 'price-desc')
    expect(products).toEqual(copy)
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i)
  it('slices pages and clamps out-of-range pages', () => {
    expect(paginate(items, 1, 12)).toMatchObject({ page: 1, pages: 3, total: 25 })
    expect(paginate(items, 3, 12).items).toHaveLength(1)
    expect(paginate(items, 99, 12).page).toBe(3)
    expect(paginate(items, 0, 12).page).toBe(1)
    expect(paginate([], 1, 12)).toMatchObject({ page: 1, pages: 1, total: 0, items: [] })
  })
})

describe('relatedProducts', () => {
  it('returns same-category products excluding the product itself', () => {
    expect(relatedProducts(products, products[0]).map((p) => p.id)).toEqual(['p2'])
  })
  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, name: `X${i}`, category: 'C', price: 1, stock: 1 }))
    expect(relatedProducts(many, many[0], 4)).toHaveLength(4)
  })
})
