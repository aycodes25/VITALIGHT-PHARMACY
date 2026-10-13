// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider } from '../context/StoreContext.jsx'
import ProductPage from './ProductPage.jsx'

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

function setup(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CatalogProvider><StoreProvider>
        <Routes><Route path="/product/:id" element={<ProductPage />} /><Route path="*" element={<p>other</p>} /></Routes>
      </StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

function GoTo({ to }) {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate(to)}>Go to {to}</button>
}

function setupWithLink(path, to) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CatalogProvider><StoreProvider>
        <GoTo to={to} />
        <Routes><Route path="/product/:id" element={<ProductPage />} /></Routes>
      </StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

function mockLiveCatalog(products) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ products, categories: [{ name: 'Medicines & pain relief', icon: 'x', description: '' }] }),
  })
}

function liveProduct(overrides) {
  return {
    id: 'live-x',
    name: 'Live product',
    category: 'Medicines & pain relief',
    brand: 'Vitalight',
    detail: 'Test detail',
    price: 1000,
    oldPrice: null,
    art: 'strip',
    color: 'mint',
    image_url: null,
    stock: 5,
    rx_required: false,
    ...overrides,
  }
}

function quantityText() {
  return screen.getByRole('group', { name: 'Quantity' }).querySelector('span').textContent
}

describe('ProductPage', () => {
  it('renders a product with price and stock state', () => {
    setup('/product/paracetamol-500mg')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Paracetamol 500 mg Tablets')
    expect(document.querySelector('.price.big').textContent).toBe('₦1,200')
    expect(document.querySelector('.stock').textContent).toBe('In stock')
  })
  it('shows the prescription notice for Rx products', () => {
    setup('/product/amoxicillin-500mg')
    expect(screen.getByText(/pharmacist will verify your prescription/i)).toBeTruthy()
  })
  it('omits the prescription notice for non-Rx products', () => {
    setup('/product/paracetamol-500mg')
    expect(screen.queryByText(/pharmacist will verify your prescription/i)).toBeNull()
  })
  it('adds the chosen quantity to the basket', () => {
    setup('/product/paracetamol-500mg')
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByRole('button', { name: /Add to basket/ }))
    expect(JSON.parse(localStorage.getItem('vitalight.cart'))).toEqual({ 'paracetamol-500mg': 3 })
  })
  it('resets the quantity to 1 when navigating to another product', () => {
    setupWithLink('/product/paracetamol-500mg', '/product/ibuprofen-400mg')
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    expect(quantityText()).toBe('3')
    fireEvent.click(screen.getByRole('button', { name: /Go to/ }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ibuprofen 400 mg Tablets')
    expect(quantityText()).toBe('1')
  })
  it('disables Increase once the quantity reaches the available stock', async () => {
    mockLiveCatalog([liveProduct({ id: 'live-low', name: 'Low stock', stock: 2 })])
    setup('/product/live-low')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Low stock'))
    const increase = screen.getByLabelText('Increase quantity')
    expect(increase.disabled).toBe(false)
    fireEvent.click(increase)
    expect(quantityText()).toBe('2')
    expect(screen.getByLabelText('Increase quantity').disabled).toBe(true)
  })
  it('disables Add to basket for an out-of-stock product', async () => {
    mockLiveCatalog([liveProduct({ id: 'live-out', name: 'Sold out', stock: 0 })])
    setup('/product/live-out')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sold out'))
    expect(document.querySelector('.stock').textContent).toBe('Out of stock')
    expect(screen.getByRole('button', { name: /Add to basket/ }).disabled).toBe(true)
  })
  it('shows no old price when there is no discount', async () => {
    mockLiveCatalog([liveProduct({ id: 'live-same', name: 'No discount', price: 1000, oldPrice: 1000 })])
    setup('/product/live-same')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('No discount'))
    expect(document.querySelector('del')).toBeNull()
  })
  it('shows a loading state, not not-found, while the catalogue loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
    setup('/product/live-only')
    expect(screen.getByRole('status').textContent).toMatch(/Loading/)
    expect(screen.queryByText(/couldn’t find that page/)).toBeNull()
  })
  it('shows not-found once loading has failed and the product is still missing', async () => {
    setup('/product/live-only')
    await waitFor(() => expect(screen.getByText(/couldn’t find that page/)).toBeTruthy())
  })
})
