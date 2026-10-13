import { describe, expect, it } from 'vitest'
import { categories, products } from './catalog.js'
import { ART_KEYS, COLOR_KEYS } from './artKeys.js'

describe('starter catalogue', () => {
  it('has 12 categories and about 120 products', () => {
    expect(categories).toHaveLength(12)
    expect(products.length).toBeGreaterThanOrEqual(110)
    expect(products.length).toBeLessThanOrEqual(130)
  })
  it('has unique, valid product ids', () => {
    const ids = products.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(60)
  })
  it('keeps the original seven product ids', () => {
    const ids = new Set(products.map((p) => p.id))
    for (const id of ['daily-vitamins', 'vitamin-c', 'gentle-cleanser', 'first-aid-kit', 'omega-3', 'digital-thermometer', 'oral-rehydration-salts']) {
      expect(ids.has(id)).toBe(true)
    }
  })
  it('every product satisfies the database constraints', () => {
    const categoryNames = new Set(categories.map((c) => c.name))
    for (const p of products) {
      expect(categoryNames.has(p.category), p.id).toBe(true)
      expect(ART_KEYS.includes(p.art), p.id).toBe(true)
      expect(COLOR_KEYS.includes(p.color), p.id).toBe(true)
      expect(Number.isInteger(p.price) && p.price >= 0, p.id).toBe(true)
      expect(p.oldPrice === null || (Number.isInteger(p.oldPrice) && p.oldPrice > p.price), p.id).toBe(true)
      expect(p.name.length >= 2 && p.name.length <= 120, p.id).toBe(true)
      expect(p.detail.length <= 240, p.id).toBe(true)
      expect(p.tag.length <= 30, p.id).toBe(true)
      expect(p.brand.length <= 60, p.id).toBe(true)
      expect(Number.isInteger(p.stock) && p.stock >= 0, p.id).toBe(true)
    }
  })
  it('every category has at least 8 products', () => {
    for (const c of categories) {
      expect(products.filter((p) => p.category === c.name).length, c.name).toBeGreaterThanOrEqual(8)
    }
  })
  it('category fields satisfy constraints', () => {
    for (const c of categories) {
      expect(c.name.length >= 2 && c.name.length <= 80).toBe(true)
      expect(c.description.length <= 160).toBe(true)
      expect(c.icon.length >= 1 && c.icon.length <= 8).toBe(true)
    }
  })
})
