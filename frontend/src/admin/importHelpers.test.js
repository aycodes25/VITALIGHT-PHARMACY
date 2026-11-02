import { describe, expect, it } from 'vitest'
import { draftFromItem, itemProblems, payloadFromDraft, safeHttpUrl, summarize } from './importHelpers.js'

const item = {
  id: 'i1', status: 'pending', suggested_category: 'Medicines', duplicate: null,
  data: { name: 'Paracetamol', description: 'Pain relief', price: 500, old_price: 600, brand: 'Acme', images: ['https://cdn.example/a.jpg'] },
}

describe('draftFromItem', () => {
  it('copies scanned fields and pre-fills the suggested category', () => {
    expect(draftFromItem(item)).toEqual({
      name: 'Paracetamol', detail: 'Pain relief', brand: 'Acme', tag: '', category: 'Medicines',
      price: 500, old_price: 600, stock: 0, images: ['https://cdn.example/a.jpg'],
    })
  })

  it('tolerates missing data', () => {
    expect(draftFromItem({ id: 'x', data: {} })).toMatchObject({ name: '', category: '', price: '', old_price: '', images: [] })
  })
})

describe('itemProblems', () => {
  it('accepts a complete draft', () => {
    expect(itemProblems(draftFromItem(item))).toEqual([])
  })

  it('lists what is missing', () => {
    const problems = itemProblems({ ...draftFromItem(item), name: ' ', category: '', price: '', stock: '' })
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringMatching(/name/i), expect.stringMatching(/category/i), expect.stringMatching(/price/i), expect.stringMatching(/stock/i),
    ]))
  })

  it('rejects fractional prices and over-long text', () => {
    expect(itemProblems({ ...draftFromItem(item), price: 12.5 })).toHaveLength(1)
    expect(itemProblems({ ...draftFromItem(item), detail: 'x'.repeat(241) })).toHaveLength(1)
    expect(itemProblems({ ...draftFromItem(item), old_price: 'abc' })).toHaveLength(1)
  })
})

describe('payloadFromDraft', () => {
  it('converts form strings to the approve request body', () => {
    const body = payloadFromDraft({ ...draftFromItem(item), name: ' Paracetamol 500mg ', price: '550', old_price: '', stock: '12' })
    expect(body).toEqual({
      name: 'Paracetamol 500mg', detail: 'Pain relief', brand: 'Acme', tag: '', category: 'Medicines',
      price: 550, old_price: null, stock: 12, image_urls: ['https://cdn.example/a.jpg'],
      is_active: true, featured: false, art: 'vitamin', color: 'lavender',
    })
  })
})

describe('summarize', () => {
  it('counts items by status', () => {
    const items = [{ status: 'pending' }, { status: 'pending' }, { status: 'approved' }, { status: 'rejected' }]
    expect(summarize(items)).toEqual({ total: 4, pending: 2, approved: 1, rejected: 1 })
  })
})

describe('safeHttpUrl', () => {
  it('allows only http and https URLs', () => {
    expect(safeHttpUrl('https://shop.example/a')).toBe('https://shop.example/a')
    expect(safeHttpUrl('http://shop.example/a')).toBe('http://shop.example/a')
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,hi')).toBeNull()
    expect(safeHttpUrl('not a url')).toBeNull()
    expect(safeHttpUrl(null)).toBeNull()
  })
})
