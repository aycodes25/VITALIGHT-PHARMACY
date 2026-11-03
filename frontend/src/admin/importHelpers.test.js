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

describe('numeric validation', () => {
  const base = draftFromItem(item)
  it('treats whitespace-only values as blank', () => {
    expect(itemProblems({ ...base, price: '   ' })).toEqual([expect.stringMatching(/price/i)])
    expect(itemProblems({ ...base, stock: '  ' })).toEqual([expect.stringMatching(/stock/i)])
    expect(itemProblems({ ...base, old_price: '  ' })).toEqual([])
  })

  it('refuses exponent, hex, signed and decimal strings', () => {
    for (const bad of ['1e3', '0x10', '1.0e1', '+5', '-5', '1.0', '12.5']) {
      expect(itemProblems({ ...base, price: bad })).toHaveLength(1)
      expect(itemProblems({ ...base, stock: bad })).toHaveLength(1)
      expect(itemProblems({ ...base, old_price: bad })).toHaveLength(1)
    }
  })

  it('accepts digit strings and integer numbers', () => {
    expect(itemProblems({ ...base, price: '12', stock: ' 3 ', old_price: '20' })).toEqual([])
    expect(itemProblems({ ...base, price: 12, stock: 0, old_price: 20 })).toEqual([])
  })

  it('builds the payload from trimmed values', () => {
    const body = payloadFromDraft({ ...base, price: ' 12 ', old_price: '   ', stock: ' 4' })
    expect(body).toMatchObject({ price: 12, old_price: null, stock: 4 })
  })
})

describe('draftFromItem images', () => {
  it('removes duplicate image urls', () => {
    const draft = draftFromItem({ id: 'x', data: { images: ['https://a/1.jpg', 'https://a/1.jpg', 'https://a/2.jpg'] } })
    expect(draft.images).toEqual(['https://a/1.jpg', 'https://a/2.jpg'])
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
