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
  it('reports sample status when the API returns an empty products list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ products: [], categories: [{ name: 'C', icon: 'x', description: '' }] }),
    })
    render(<CatalogProvider><Probe /></CatalogProvider>)
    await waitFor(() => expect(screen.getByText(/^sample:/)).toBeTruthy())
    expect(Number(screen.getByText(/^sample:/).textContent.split(':')[1])).toBeGreaterThan(100)
  })
  it('reports sample status when products is not an array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ products: null }) })
    render(<CatalogProvider><Probe /></CatalogProvider>)
    await waitFor(() => expect(screen.getByText(/^sample:/)).toBeTruthy())
  })
  it('stays live with live products when categories are empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ products: [{ id: 'live-1', name: 'Live', category: 'C', price: 1, stock: 1 }], categories: [] }),
    })
    render(<CatalogProvider><Probe /></CatalogProvider>)
    await waitFor(() => expect(screen.getByText('live:1:live-1')).toBeTruthy())
  })
  it('does not throw or warn when unmounted before the response resolves', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    let resolve
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((r) => { resolve = r }))
    const view = render(<CatalogProvider><Probe /></CatalogProvider>)
    view.unmount()
    resolve({ ok: true, json: async () => ({ products: [], categories: [] }) })
    await new Promise((r) => setTimeout(r, 10))
    expect(errors).not.toHaveBeenCalled()
  })
})
