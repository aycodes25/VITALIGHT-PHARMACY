import { describe, expect, it } from 'vitest'
import { buildChecklistCsv } from './photoChecklist.js'

describe('buildChecklistCsv', () => {
  it('lists the filename each product photo must have', () => {
    const csv = buildChecklistCsv([
      { id: 'paracetamol-500mg', name: 'Paracetamol 500 mg Tablets', brand: 'Vitalight', category: 'Medicines & pain relief', image_url: null },
    ])
    expect(csv.split('\n')[0]).toBe('filename,product_id,name,brand,category,has_photo')
    expect(csv.split('\n')[1]).toBe('paracetamol-500mg.jpg,paracetamol-500mg,Paracetamol 500 mg Tablets,Vitalight,Medicines & pain relief,NO')
  })

  it('marks products that already have a photo', () => {
    const csv = buildChecklistCsv([
      { id: 'a', name: 'A', image_url: 'https://x/y.png' },
      { id: 'b', name: 'B', images: ['https://x/z.png'] },
      { id: 'c', name: 'C' },
    ])
    const rows = csv.trim().split('\n').slice(1).map((r) => r.split(',').pop())
    expect(rows).toEqual(['yes', 'yes', 'NO'])
  })

  it('escapes commas and quotes', () => {
    const csv = buildChecklistCsv([{ id: 'x', name: 'Cough, "strong" syrup', brand: '', category: '' }])
    expect(csv).toContain('"Cough, ""strong"" syrup"')
  })
})
