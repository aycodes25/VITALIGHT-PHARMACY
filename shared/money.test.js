import { describe, expect, it } from 'vitest'
import { formatPrice } from './money.js'

describe('formatPrice', () => {
  it('formats whole naira with grouping', () => {
    expect(formatPrice(8500)).toBe('₦8,500')
    expect(formatPrice(1234567)).toBe('₦1,234,567')
    expect(formatPrice(0)).toBe('₦0')
  })
  it('treats invalid input as zero', () => {
    expect(formatPrice(undefined)).toBe('₦0')
    expect(formatPrice(NaN)).toBe('₦0')
  })
})
