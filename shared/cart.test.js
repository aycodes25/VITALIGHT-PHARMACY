import { describe, expect, it } from 'vitest'
import { cartReducer, cartLines, cartTotals, MAX_QUANTITY } from './cart.js'

const products = [
  { id: 'a', name: 'A', price: 1000, rx_required: false },
  { id: 'b', name: 'B', price: 2500, rx_required: true },
]

describe('cartReducer', () => {
  it('adds and accumulates quantities', () => {
    let state = cartReducer({}, { type: 'add', id: 'a' })
    state = cartReducer(state, { type: 'add', id: 'a', quantity: 2 })
    expect(state).toEqual({ a: 3 })
  })
  it('caps quantity at MAX_QUANTITY', () => {
    const state = cartReducer({ a: 98 }, { type: 'add', id: 'a', quantity: 10 })
    expect(state.a).toBe(MAX_QUANTITY)
  })
  it('set below 1 or NaN removes the line', () => {
    expect(cartReducer({ a: 2 }, { type: 'set', id: 'a', quantity: 0 })).toEqual({})
    expect(cartReducer({ a: 2 }, { type: 'set', id: 'a', quantity: NaN })).toEqual({})
  })
  it('set updates quantity; remove and clear work', () => {
    expect(cartReducer({ a: 2 }, { type: 'set', id: 'a', quantity: 5 })).toEqual({ a: 5 })
    expect(cartReducer({ a: 2, b: 1 }, { type: 'remove', id: 'a' })).toEqual({ b: 1 })
    expect(cartReducer({ a: 2 }, { type: 'clear' })).toEqual({})
  })
})

describe('cartLines / cartTotals', () => {
  it('ignores unknown ids and totals correctly', () => {
    const lines = cartLines({ a: 2, b: 1, ghost: 4 }, products)
    expect(lines).toHaveLength(2)
    expect(cartTotals(lines)).toEqual({ count: 3, total: 4500, hasRx: true })
  })
  it('hasRx is false without prescription items', () => {
    const lines = cartLines({ a: 1 }, products)
    expect(cartTotals(lines).hasRx).toBe(false)
  })
})
