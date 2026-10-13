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
})
