// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const useStoreMock = vi.hoisted(() => vi.fn())
vi.mock('../context/StoreContext.jsx', () => ({ useStore: useStoreMock }))

import CartDrawer from './CartDrawer.jsx'

function renderWith(quantity, stock) {
  useStoreMock.mockReturnValue({
    cartOpen: true, closeCart: () => {}, setQty: () => {}, openOrder: () => {},
    totals: { count: quantity, total: 100 * quantity, hasRx: false },
    lines: [{ product: { id: 'p', name: 'P', price: 100, stock, art: 'strip', color: 'mint' }, quantity, lineTotal: 100 * quantity }],
  })
  render(<MemoryRouter><CartDrawer /></MemoryRouter>)
}

describe('CartDrawer stock guard', () => {
  it('disables the order button when a line exceeds the stock', () => {
    renderWith(5, 2)
    expect(screen.getByRole('button', { name: /Request this order/ }).disabled).toBe(true)
    expect(screen.getByText(/Reduce quantities to the available stock/)).toBeTruthy()
  })
  it('keeps the order button enabled when quantity equals the stock', () => {
    renderWith(2, 2)
    expect(screen.getByRole('button', { name: /Request this order/ }).disabled).toBe(false)
  })
})
