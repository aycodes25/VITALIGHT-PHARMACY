// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
})
