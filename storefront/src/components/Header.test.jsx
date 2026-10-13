// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation, useParams } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider } from '../context/StoreContext.jsx'
import Header from './Header.jsx'

function SearchPage() {
  const location = useLocation()
  return <p data-testid="search-page">{location.search}</p>
}

function ProductPage() {
  const { id } = useParams()
  return <p data-testid="product-page">product {id}</p>
}

function setup() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CatalogProvider>
        <StoreProvider>
          <Header />
          <Routes>
            <Route path="/search" element={<SearchPage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="*" element={<p>elsewhere</p>} />
          </Routes>
        </StoreProvider>
      </CatalogProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const suggestionList = () => document.querySelector('.suggestions')

describe('Header search', () => {
  it('shows suggestions after typing two or more characters', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Search products'), 'para')
    expect(suggestionList()).toBeTruthy()
    expect(suggestionList().querySelectorAll('a').length).toBeGreaterThan(0)
  })

  it('keeps suggestions open while keyboard focus moves to a suggestion link', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Search products'), 'para')
    await user.tab()
    const link = suggestionList().querySelector('a')
    expect(document.activeElement).toBe(link)
    expect(suggestionList()).toBeTruthy()
  })

  it('closes when focus leaves the search form', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Search products'), 'para')
    await user.click(document.body)
    expect(suggestionList()).toBeNull()
  })

  it('closes on Escape and reopens when typing again', async () => {
    const user = userEvent.setup()
    setup()
    const input = screen.getByLabelText('Search products')
    await user.type(input, 'para')
    await user.keyboard('{Escape}')
    expect(suggestionList()).toBeNull()
    await user.type(input, 'c')
    expect(suggestionList()).toBeTruthy()
  })

  it('submits to /search?q=', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Search products'), 'cough syrup{Enter}')
    expect(screen.getByTestId('search-page').textContent).toBe('?q=cough%20syrup')
  })
})

describe('Header suggestions on press', () => {
  it('prevents mousedown default on the suggestion list so focus stays on the input', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Search products'), 'para')
    const list = suggestionList()
    expect(list).toBeTruthy()
    const notPrevented = fireEvent.mouseDown(list)
    expect(notPrevented).toBe(false)
  })

  it('navigates to the product page when a suggestion is clicked', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Search products'), 'para')
    const link = suggestionList().querySelector('a')
    const id = link.getAttribute('href').replace('/product/', '')
    await user.click(link)
    expect(screen.getByTestId('product-page').textContent).toBe(`product ${id}`)
  })
})

describe('Header basket label', () => {
  it('uses plural for zero items and hides the badge', () => {
    setup()
    const basket = screen.getByRole('button', { name: 'Open basket, 0 items' })
    expect(basket.querySelector('.count-badge')).toBeNull()
  })

  it('uses singular for one item and shows the badge', async () => {
    localStorage.setItem('vitalight.cart', JSON.stringify({ 'paracetamol-500mg': 1 }))
    setup()
    const basket = screen.getByRole('button', { name: 'Open basket, 1 item' })
    expect(basket.querySelector('.count-badge').textContent).toBe('1')
  })

  it('uses plural for several items', () => {
    localStorage.setItem('vitalight.cart', JSON.stringify({ 'paracetamol-500mg': 3 }))
    setup()
    expect(screen.getByRole('button', { name: 'Open basket, 3 items' })).toBeTruthy()
  })
})
