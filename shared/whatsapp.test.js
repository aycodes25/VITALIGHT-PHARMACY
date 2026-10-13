import { describe, expect, it } from 'vitest'
import { buildOrderMessage, normalizeWhatsAppNumber, whatsAppLink } from './whatsapp.js'

describe('normalizeWhatsAppNumber', () => {
  it('converts a local Nigerian number to international digits', () => {
    expect(normalizeWhatsAppNumber('08105079027')).toBe('2348105079027')
  })
  it('strips spaces and plus signs', () => {
    expect(normalizeWhatsAppNumber('+234 810 507 9027')).toBe('2348105079027')
  })
  it('keeps an already international number', () => {
    expect(normalizeWhatsAppNumber('2348105079027')).toBe('2348105079027')
  })
  it('returns an empty string for empty or too-short input', () => {
    expect(normalizeWhatsAppNumber('')).toBe('')
    expect(normalizeWhatsAppNumber(undefined)).toBe('')
    expect(normalizeWhatsAppNumber('12345')).toBe('')
    expect(normalizeWhatsAppNumber('abc')).toBe('')
  })
})

describe('whatsAppLink', () => {
  it('builds a plain wa.me link', () => {
    expect(whatsAppLink('2348105079027')).toBe('https://wa.me/2348105079027')
  })
  it('returns an empty string without a number', () => {
    expect(whatsAppLink('', 'hi')).toBe('')
  })
  it('encodes the text and round-trips', () => {
    const text = 'Order & more\nTotal: ₦2,400 x 2'
    const link = whatsAppLink('2348105079027', text)
    const query = link.split('?text=')[1]
    expect(query).not.toMatch(/[ \n&₦]/)
    expect(decodeURIComponent(query)).toBe(text)
  })
})

describe('buildOrderMessage', () => {
  const base = {
    orderId: 'abcdef12-3456-7890',
    name: 'Ada Okafor',
    phone: '+234 800 000 0000',
    address: '12 Example Street',
    lines: [
      { product: { name: 'Paracetamol 500 mg Tablets' }, quantity: 2, lineTotal: 2400 },
      { product: { name: 'Vitamin C' }, quantity: 1, lineTotal: 1500 },
    ],
    total: 3900,
    hasRx: false,
  }
  it('builds the exact message', () => {
    expect(buildOrderMessage(base)).toBe([
      'New order request - Vitalight Pharmacy',
      'Order: #ABCDEF12',
      'Name: Ada Okafor',
      'Phone: +234 800 000 0000',
      'Address: 12 Example Street',
      'Items:',
      '- 2 x Paracetamol 500 mg Tablets (₦2,400)',
      '- 1 x Vitamin C (₦1,500)',
      'Estimated total: ₦3,900',
    ].join('\n'))
  })
  it('adds the prescription line only when needed', () => {
    expect(buildOrderMessage({ ...base, hasRx: true })).toMatch(/\nIncludes prescription medicines - please verify\.$/)
    expect(buildOrderMessage(base)).not.toMatch(/prescription/)
  })
  it('omits the order line without an id', () => {
    expect(buildOrderMessage({ ...base, orderId: '' })).not.toMatch(/Order:/)
  })
})
