import { describe, expect, it } from 'vitest'
import { validateProductInput } from '../lib/validate.js'

const base = {
  name: 'Paracetamol 500 mg', category: 'Medicines & pain relief', detail: '24 tablets',
  price: 1200, old_price: null, tag: 'NEW', art: 'strip', color: 'mint',
  stock: 10, is_active: true, featured: false,
}

describe('validateProductInput', () => {
  it('accepts a valid product and trims strings', () => {
    const result = validateProductInput({ ...base, name: '  Paracetamol 500 mg ' })
    expect(result.error).toBeUndefined()
    expect(result.value.name).toBe('Paracetamol 500 mg')
    expect(result.value.old_price).toBeNull()
  })
  it('only includes optional fields that were provided', () => {
    const without = validateProductInput(base).value
    expect('brand' in without).toBe(false)
    expect('rx_required' in without).toBe(false)
    expect('sort_order' in without).toBe(false)
    const withAll = validateProductInput({ ...base, brand: ' Vitalight ', rx_required: true, sort_order: 3 }).value
    expect(withAll).toMatchObject({ brand: 'Vitalight', rx_required: true, sort_order: 3 })
  })
  it('accepts the new art keys and rejects unknown ones', () => {
    expect(validateProductInput({ ...base, art: 'tube' }).error).toBeUndefined()
    expect(validateProductInput({ ...base, art: 'unicorn' }).error).toMatch(/illustration/)
  })
  it('requires a valid id when requireId is set', () => {
    expect(validateProductInput(base, { requireId: true }).error).toMatch(/product ID/)
    expect(validateProductInput({ ...base, id: 'Bad Id' }, { requireId: true }).error).toMatch(/product ID/)
    expect(validateProductInput({ ...base, id: 'good-id' }, { requireId: true }).value.id).toBe('good-id')
  })
  it('rejects bad prices, stock and optional fields', () => {
    expect(validateProductInput({ ...base, price: 12.5 }).error).toMatch(/price/)
    expect(validateProductInput({ ...base, stock: -1 }).error).toMatch(/Stock/)
    expect(validateProductInput({ ...base, rx_required: 'yes' }).error).toMatch(/prescription/)
    expect(validateProductInput({ ...base, sort_order: 1000 }).error).toMatch(/order/)
    expect(validateProductInput({ ...base, brand: 'x'.repeat(61) }).error).toMatch(/Brand/)
  })
  describe('images gallery', () => {
    const supabaseUrl = 'https://example.supabase.co'
    const url = (name) => `${supabaseUrl}/storage/v1/object/public/product-images/p/${name}.png`
    const run = (extra) => validateProductInput({ ...base, ...extra }, { supabaseUrl })
    it('sets images and derives image_url from the first photo', () => {
      const { value, error } = run({ images: [url('a'), url('b')], image_url: url('z') })
      expect(error).toBeUndefined()
      expect(value.images).toEqual([url('a'), url('b')])
      expect(value.image_url).toBe(url('a'))
    })
    it('clears image_url for an empty list', () => {
      const { value } = run({ images: [], image_url: url('z') })
      expect(value.images).toEqual([])
      expect(value.image_url).toBeNull()
    })
    it('leaves images out when it is absent', () => {
      const { value } = run({ image_url: url('z') })
      expect('images' in value).toBe(false)
      expect(value.image_url).toBe(url('z'))
    })
    it('rejects more than 8, duplicates, non-arrays and foreign urls', () => {
      const nine = Array.from({ length: 9 }, (_, i) => url(String(i)))
      expect(run({ images: nine }).error).toMatch(/up to 8/)
      expect(run({ images: [url('a'), url('a')] }).error).toMatch(/once/)
      expect(run({ images: 'x' }).error).toMatch(/photos/)
      expect(run({ images: [url('a'), 'https://evil.test/x.png'] }).error).toMatch(/image library/)
      expect(run({ images: [42] }).error).toMatch(/image library/)
    })
  })
  describe('gallery urls tied to the product', () => {
    const supabaseUrl = 'https://example.supabase.co'
    const base_ = `${supabaseUrl}/storage/v1/object/public/product-images`
    const run = (images, productId = 'p') => validateProductInput({ ...base, images }, { supabaseUrl, productId })
    it('accepts urls under the product folder', () => {
      expect(run([`${base_}/p/a.png`]).error).toBeUndefined()
    })
    it('rejects another product folder, a prefix lookalike and path traversal', () => {
      expect(run([`${base_}/other/a.png`]).error).toMatch(/image library/)
      expect(run([`${base_}/p2/a.png`]).error).toMatch(/image library/)
      expect(run([`${base_}/p/../other/a.png`]).error).toMatch(/image library/)
    })
    it('keeps the bucket-wide check when no productId is given', () => {
      expect(validateProductInput({ ...base, images: [`${base_}/other/a.png`] }, { supabaseUrl }).error).toBeUndefined()
    })
  })
  it('only accepts images from the product-images bucket', () => {
    const supabaseUrl = 'https://example.supabase.co'
    const ok = `${supabaseUrl}/storage/v1/object/public/product-images/a/b.png`
    expect(validateProductInput({ ...base, image_url: ok }, { supabaseUrl }).error).toBeUndefined()
    expect(validateProductInput({ ...base, image_url: 'https://evil.test/x.png' }, { supabaseUrl }).error).toMatch(/image library/)
  })
})
