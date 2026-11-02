import { describe, expect, it } from 'vitest'
import { parsePrice } from '../../lib/import/price.js'

describe('parsePrice', () => {
  it.each([
    [8500, 8500],
    ['8500', 8500],
    ['₦8,500.00', 8500],
    ['NGN 1,234.50', 1235],
    ['85.00', 85],
    ['1.234,50', 1235],
    ['8.500', 8500],
    ['  12 ', 12],
  ])('parses %j as %j', (input, expected) => expect(parsePrice(input)).toBe(expected))

  it.each([[''], [null], [undefined], ['free'], [-5], [Number.NaN]])('returns null for %j', (input) => {
    expect(parsePrice(input)).toBeNull()
  })

  it.each([['₦5,000 - ₦8,000'], ['5000 to 8000'], ['From 100 to 200'], [','], ['₦,'], ['.'], ['-5']])(
    'returns null for range or malformed %j',
    (input) => expect(parsePrice(input)).toBeNull(),
  )
})
