// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider } from '../context/StoreContext.jsx'
import ProductCard from './ProductCard.jsx'

const base = {
  id: 'paracetamol-500mg', name: 'Paracetamol 500 mg Tablets', brand: 'Vitalight', category: 'Medicines & pain relief',
  detail: '24 tablets', price: 1200, oldPrice: null, tag: '', art: 'strip', color: 'mint', image_url: null, stock: 10, rx_required: false,
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

function setup(product) {
  return render(
    <MemoryRouter>
      <CatalogProvider><StoreProvider><ProductCard product={product} /></StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

describe('ProductCard', () => {
  it('shows name, brand, price and links to the product page', () => {
    setup(base)
    expect(screen.getByText('Paracetamol 500 mg Tablets').closest('a').getAttribute('href')).toBe('/product/paracetamol-500mg')
    expect(screen.getByText('Vitalight')).toBeTruthy()
    expect(screen.getByText('₦1,200')).toBeTruthy()
  })
  it('shows a discount badge and the old price when on sale', () => {
    setup({ ...base, oldPrice: 1600 })
    expect(screen.getByText('-25%')).toBeTruthy()
    expect(screen.getByText('₦1,600')).toBeTruthy()
  })
  it('shows an Rx badge for prescription products', () => {
    setup({ ...base, rx_required: true })
    expect(screen.getByText('Rx')).toBeTruthy()
  })
  it('disables add-to-basket when out of stock', () => {
    setup({ ...base, stock: 0 })
    expect(screen.getByLabelText(/Add Paracetamol 500 mg Tablets to basket/).disabled).toBe(true)
    expect(screen.getByText('Out of stock')).toBeTruthy()
  })
  it('adds to the basket', () => {
    setup(base)
    fireEvent.click(screen.getByLabelText(/Add Paracetamol 500 mg Tablets to basket/))
    expect(JSON.parse(localStorage.getItem('vitalight.cart'))).toEqual({ 'paracetamol-500mg': 1 })
  })
  it('keeps the save button usable when out of stock', () => {
    const { container } = setup({ ...base, stock: 0 })
    const btn = screen.getByLabelText(/^Save Paracetamol 500 mg Tablets/)
    const overlay = container.querySelector('.out-of-stock')
    expect(overlay).toBeTruthy()
    expect(overlay.contains(btn)).toBe(false)
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    expect(JSON.parse(localStorage.getItem('vitalight.saved'))).toContain('paracetamol-500mg')
  })
  it('renders no old price when oldPrice is 0 or not above price', () => {
    const { container, unmount } = setup({ ...base, oldPrice: 0 })
    expect(container.querySelector('del')).toBeNull()
    expect(container.querySelector('.price').textContent).toBe('₦1,200')
    unmount()
    const second = setup({ ...base, oldPrice: 900 })
    expect(second.container.querySelector('del')).toBeNull()
  })
  it('shows both Rx and sale badges together', () => {
    setup({ ...base, rx_required: true, oldPrice: 1600 })
    expect(screen.getByText('Rx')).toBeTruthy()
    expect(screen.getByText('-25%')).toBeTruthy()
  })
  it('shows the tag only when there is no discount or Rx', () => {
    const { unmount } = setup({ ...base, tag: 'NEW' })
    expect(screen.getByText('NEW')).toBeTruthy()
    unmount()
    setup({ ...base, tag: 'NEW', oldPrice: 1600 })
    expect(screen.queryByText('NEW')).toBeNull()
  })
})
