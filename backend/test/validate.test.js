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
  it('only accepts images from the product-images bucket', () => {
    const supabaseUrl = 'https://example.supabase.co'
    const ok = `${supabaseUrl}/storage/v1/object/public/product-images/a/b.png`
    expect(validateProductInput({ ...base, image_url: ok }, { supabaseUrl }).error).toBeUndefined()
    expect(validateProductInput({ ...base, image_url: 'https://evil.test/x.png' }, { supabaseUrl }).error).toMatch(/image library/)
  })
})
