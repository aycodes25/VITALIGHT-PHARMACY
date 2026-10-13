// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider } from '../context/StoreContext.jsx'
import CatalogBrowser from './CatalogBrowser.jsx'

const mk = (i, extra = {}) => ({
  id: `p${i}`, name: `Product ${String(i).padStart(2, '0')}`, brand: i % 2 ? 'Alpha' : 'Beta', category: 'C',
  detail: '', price: 1000 + i * 100, oldPrice: null, tag: '', art: 'vitamin', color: 'mint', stock: 5, rx_required: false, ...extra,
})
const products = Array.from({ length: 30 }, (_, i) => mk(i + 1, i === 0 ? { oldPrice: 5000 } : {}))

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

function setup(props = {}) {
  return render(
    <MemoryRouter>
      <CatalogProvider><StoreProvider><CatalogBrowser title="Test" products={products} {...props} /></StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

describe('CatalogBrowser', () => {
  it('paginates 12 per page and shows a result count', () => {
    setup()
    expect(screen.getByText('30 products')).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('article')).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('article')).toHaveLength(6)
  })
  it('filters to on-sale items', () => {
    setup()
    fireEvent.click(screen.getByLabelText('On sale'))
    expect(screen.getByText('1 product')).toBeTruthy()
  })
  it('filters by brand', () => {
    setup()
    fireEvent.click(screen.getByLabelText('Alpha'))
    expect(screen.getByText('15 products')).toBeTruthy()
  })
  it('sorts by price high to low', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'price-desc' } })
    const first = within(screen.getAllByRole('article')[0]).getByRole('heading')
    expect(first.textContent).toBe('Product 30')
  })
  it('shows an empty message when nothing matches', () => {
    setup({ products: [] })
    expect(screen.getByText(/No products match/)).toBeTruthy()
  })
})
