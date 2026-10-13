// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider } from '../context/StoreContext.jsx'
import HomePage from './HomePage.jsx'

function mockLiveCatalogue(categoryNames) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      products: [{ id: 'p1', name: 'Sample', category: categoryNames[0], price: 100, stock: 5, art: 'vitamin', color: 'mint' }],
      categories: categoryNames.map((name, i) => ({ name, icon: 'x', description: '', sort_order: i })),
    }),
  })
}

function setup() {
  return render(
    <MemoryRouter>
      <CatalogProvider><StoreProvider><HomePage /></StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('HomePage concern tiles', () => {
  it('hides tiles whose category does not exist in the live catalogue', async () => {
    mockLiveCatalogue(['Vitamins & supplements', 'Skin care & dermatology'])
    setup()
    await waitFor(() => expect(screen.getByText('Immunity & vitamins')).toBeTruthy())
    expect(screen.getByText('Skin & sun care')).toBeTruthy()
    expect(screen.queryByText('Mum & baby')).toBeNull()
    expect(screen.queryByText('Heart & diabetes')).toBeNull()
  })

  it('shows every tile when all four categories exist', async () => {
    mockLiveCatalogue(['Vitamins & supplements', 'Skin care & dermatology', 'Mother & baby', 'Diabetes & heart care'])
    setup()
    await waitFor(() => expect(screen.getByText('Mum & baby')).toBeTruthy())
    expect(screen.getByText('Heart & diabetes')).toBeTruthy()
  })

  it('every visible tile links to an existing category', async () => {
    mockLiveCatalogue(['Mother & baby'])
    const { container } = setup()
    await waitFor(() => expect(screen.getByText('Mum & baby')).toBeTruthy())
    const hrefs = [...container.querySelectorAll('.concern')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['/category/mother-and-baby'])
  })
})

describe('HomePage while the catalogue loads', () => {
  it('renders no concern tiles and no Vitamins hero button until the catalogue has loaded', async () => {
    let release
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((resolve) => { release = resolve }))
    const { container } = setup()
    expect(container.querySelectorAll('.concern')).toHaveLength(0)
    expect(screen.queryByText('Vitamins')).toBeNull()
    release({
      ok: true,
      json: async () => ({
        products: [],
        categories: [{ name: 'Vitamins & supplements', icon: 'x', description: '', sort_order: 0 }],
      }),
    })
    await waitFor(() => expect(screen.getByText('Vitamins')).toBeTruthy())
    expect(screen.getByText('Immunity & vitamins')).toBeTruthy()
  })

  it('shows the Vitamins hero button only when that category exists', async () => {
    mockLiveCatalogue(['Mother & baby'])
    setup()
    await waitFor(() => expect(screen.getByText('Mum & baby')).toBeTruthy())
    expect(screen.queryByText('Vitamins')).toBeNull()
  })
})
