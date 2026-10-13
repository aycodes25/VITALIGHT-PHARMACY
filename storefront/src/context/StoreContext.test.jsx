// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CatalogProvider } from './CatalogContext.jsx'
import { StoreProvider, useStore } from './StoreContext.jsx'

function Probe() {
  const { totals, add, toggleSaved, saved, clearCart } = useStore()
  return (
    <div>
      <span data-testid="count">{totals.count}</span>
      <span data-testid="saved">{saved.length}</span>
      <button onClick={() => add('paracetamol-500mg')}>add</button>
      <button onClick={() => toggleSaved('paracetamol-500mg')}>save</button>
      <button onClick={clearCart}>clear</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

function setup() {
  return render(<CatalogProvider><StoreProvider><Probe /></StoreProvider></CatalogProvider>)
}

describe('StoreProvider', () => {
  it('adds, saves and clears', () => {
    setup()
    fireEvent.click(screen.getByText('add'))
    fireEvent.click(screen.getByText('add'))
    expect(screen.getByTestId('count').textContent).toBe('2')
    fireEvent.click(screen.getByText('save'))
    expect(screen.getByTestId('saved').textContent).toBe('1')
    fireEvent.click(screen.getByText('clear'))
    expect(screen.getByTestId('count').textContent).toBe('0')
  })
  it('persists the cart to localStorage and restores it', () => {
    const first = setup()
    fireEvent.click(screen.getByText('add'))
    first.unmount()
    setup()
    expect(screen.getByTestId('count').textContent).toBe('1')
  })
  it('survives corrupt localStorage', () => {
    localStorage.setItem('vitalight.cart', '{not json')
    setup()
    expect(screen.getByTestId('count').textContent).toBe('0')
  })
  it('drops invalid persisted cart entries', () => {
    localStorage.setItem('vitalight.cart', JSON.stringify({ 'paracetamol-500mg': '5', 'amoxicillin-500mg': 1e9, 'vitamin-c': 2 }))
    setup()
    expect(screen.getByTestId('count').textContent).toBe('2')
  })
  it('clamps add and setQty to the known stock', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
      products: [{ id: 'live-low', name: 'Low', category: 'C', price: 100, stock: 3, art: 'strip', color: 'mint' }],
      categories: [{ name: 'C', icon: 'x', description: '' }],
    }) })
    function Clamp() {
      const { totals, add, setQty, notice } = useStore()
      return (
        <div>
          <span data-testid="count">{totals.count}</span>
          <span data-testid="notice">{notice}</span>
          <button onClick={() => add('live-low', 2)}>add2</button>
          <button onClick={() => setQty('live-low', 50)}>set50</button>
        </div>
      )
    }
    render(<CatalogProvider><StoreProvider><Clamp /></StoreProvider></CatalogProvider>)
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))
    fireEvent.click(screen.getByText('add2'))
    fireEvent.click(screen.getByText('add2'))
    expect(screen.getByTestId('count').textContent).toBe('3')
    fireEvent.click(screen.getByText('add2'))
    expect(screen.getByTestId('count').textContent).toBe('3')
    expect(screen.getByTestId('notice').textContent).toBe('All available stock is in your basket')
    fireEvent.click(screen.getByText('set50'))
    expect(screen.getByTestId('count').textContent).toBe('3')
  })
  it('hides saved ids that are not in the loaded catalogue but keeps them in storage', async () => {
    localStorage.setItem('vitalight.saved', JSON.stringify(['paracetamol-500mg', 'ghost-product']))
    setup()
    await waitFor(() => expect(screen.getByTestId('saved').textContent).toBe('1'))
    expect(JSON.parse(localStorage.getItem('vitalight.saved'))).toEqual(['paracetamol-500mg', 'ghost-product'])
  })
})
