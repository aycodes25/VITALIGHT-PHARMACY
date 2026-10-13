// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CatalogProvider, useCatalog } from './CatalogContext.jsx'

function Probe() {
  const { products, status } = useCatalog()
  return <p>{status}:{products.length}:{products[0]?.id}</p>
}

afterEach(() => vi.restoreAllMocks())

describe('CatalogProvider', () => {
  it('falls back to the bundled sample catalogue when the API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    render(<CatalogProvider><Probe /></CatalogProvider>)
    await waitFor(() => expect(screen.getByText(/^sample:/)).toBeTruthy())
    expect(Number(screen.getByText(/^sample:/).textContent.split(':')[1])).toBeGreaterThan(100)
  })
  it('uses live products when the API responds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [{ id: 'live-1', name: 'Live', category: 'C', price: 1, stock: 1 }],
        categories: [{ name: 'C', icon: 'x', description: '' }],
      }),
    })
    render(<CatalogProvider><Probe /></CatalogProvider>)
    await waitFor(() => expect(screen.getByText('live:1:live-1')).toBeTruthy())
  })
})
