// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider } from '../context/StoreContext.jsx'
import Header from './Header.jsx'
import Footer from './Footer.jsx'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

function setup() {
  return render(
    <MemoryRouter>
      <CatalogProvider>
        <StoreProvider>
          <Header />
          <Footer />
        </StoreProvider>
      </CatalogProvider>
    </MemoryRouter>,
  )
}

describe('public chrome', () => {
  it('never links customers to the admin area', () => {
    const { container } = setup()
    const adminLinks = [...container.querySelectorAll('a')].filter((a) => /\/admin/.test(a.getAttribute('href') || ''))
    expect(adminLinks).toHaveLength(0)
    expect(screen.queryByText(/admin/i)).toBeNull()
  })

  it('has no "All categories" button; categories are listed in the nav row', () => {
    setup()
    expect(screen.queryByRole('button', { name: /all categories/i })).toBeNull()
    const nav = screen.getByRole('navigation', { name: 'Categories' })
    expect(nav.querySelectorAll('a').length).toBe(12)
  })
})
