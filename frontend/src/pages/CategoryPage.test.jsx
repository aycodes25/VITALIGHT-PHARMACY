// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider } from '../context/StoreContext.jsx'
import CategoryPage from './CategoryPage.jsx'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

function setup(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CatalogProvider><StoreProvider>
        <Routes><Route path="/category/:slug" element={<CategoryPage />} /></Routes>
      </StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

describe('CategoryPage', () => {
  it('shows a loading state while the catalogue loads', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
    setup('/category/live-only-category')
    expect(screen.getByRole('status').textContent).toMatch(/Loading/)
    expect(screen.queryByText(/couldn’t find that page/)).toBeNull()
  })
  it('shows not-found after loading settles', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup('/category/live-only-category')
    await waitFor(() => expect(screen.getByText(/couldn’t find that page/)).toBeTruthy())
  })
})
