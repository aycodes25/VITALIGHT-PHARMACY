// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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

describe('ProductPage', () => {
  it('renders a product with price and stock state', () => {
    setup('/product/paracetamol-500mg')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Paracetamol 500 mg Tablets')
    expect(document.querySelector('.price.big').textContent).toBe('₦1,200')
    expect(screen.getByText(/In stock|left in stock/)).toBeTruthy()
  })
  it('shows the prescription notice for Rx products', () => {
    setup('/product/amoxicillin-500mg')
    expect(screen.getByText(/pharmacist will verify your prescription/i)).toBeTruthy()
  })
  it('adds the chosen quantity to the basket', () => {
    setup('/product/paracetamol-500mg')
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByRole('button', { name: /Add to basket/ }))
    expect(JSON.parse(localStorage.getItem('vitalight.cart'))).toEqual({ 'paracetamol-500mg': 3 })
  })
  it('shows not-found for an unknown product', () => {
    setup('/product/does-not-exist')
    expect(screen.getByText(/couldn’t find that page/)).toBeTruthy()
  })
})
