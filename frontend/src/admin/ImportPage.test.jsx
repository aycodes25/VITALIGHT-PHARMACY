// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ImportPage from './ImportPage.jsx'

const scanned = (id, name) => ({
  id, status: 'pending', product_id: null, suggested_category: 'Vitamins & supplements', duplicate: id === 'i2' ? 'Existing Zinc' : null,
  data: { name, description: 'Desc', price: 6200, old_price: null, currency: '', images: ['https://cdn.example/a.jpg'], source_url: 'https://shop.example/products/a', source_category: 'Vitamins', brand: '' },
})

function setup() {
  const authRequest = vi.fn(async (path, options = {}) => {
    if (path === '/api/admin/import/batches') return { batches: [] }
    if (path === '/api/admin/import/scan') return { batchId: 'b1', added: 2, done: true, platform: 'shopify', limitReached: false }
    if (path === '/api/admin/import/batches/b1') {
      return { batch: { id: 'b1', source_url: 'https://shop.example/', platform: 'shopify', status: 'ready' }, items: [scanned('i1', 'Vitamin C'), scanned('i2', 'Zinc')] }
    }
    if (path === '/api/admin/import/items/i1/approve') return { product: { id: 'vitamin-c' }, warnings: [] }
    if (path === '/api/admin/import/items/i2/reject') return { rejected: true }
    throw new Error(`unexpected request ${options.method ?? 'GET'} ${path}`)
  })
  const props = { authRequest, categories: [{ name: 'Vitamins & supplements' }], onProductsChanged: vi.fn(), setError: vi.fn(), setMessage: vi.fn() }
  render(<ImportPage {...props} />)
  return { authRequest, ...props }
}

describe('ImportPage', () => {
  it('scans a site, shows the total, approves one product and rejects another', async () => {
    const { authRequest, onProductsChanged } = setup()

    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'https://shop.example/' } })
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))

    await waitFor(() => expect(screen.getByTestId('import-total').textContent).toBe('2'))
    expect(screen.getByText(/Already in your store as “Existing Zinc”/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Approve Vitamin C' }))
    await waitFor(() => expect(screen.getByTestId('import-approved').textContent).toBe('1'))
    const approveCall = authRequest.mock.calls.find(([path]) => path === '/api/admin/import/items/i1/approve')
    expect(approveCall[1].method).toBe('POST')
    expect(JSON.parse(approveCall[1].body)).toMatchObject({ name: 'Vitamin C', category: 'Vitamins & supplements', price: 6200, image_urls: ['https://cdn.example/a.jpg'] })
    expect(onProductsChanged).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Reject Zinc' }))
    await waitFor(() => expect(screen.getByTestId('import-rejected').textContent).toBe('1'))
    expect(screen.getByTestId('import-pending').textContent).toBe('0')
  })

  it('blocks approval until required fields are filled', async () => {
    setup()
    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'https://shop.example/' } })
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
    await waitFor(() => expect(screen.getByTestId('import-total').textContent).toBe('2'))

    fireEvent.change(screen.getByLabelText('Category for Vitamin C'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Approve Vitamin C' }).disabled).toBe(true)
  })

  async function scanWith(handlers, items = []) {
    const authRequest = vi.fn(async (path, options = {}) => {
      if (handlers[path]) return handlers[path](options)
      if (path === '/api/admin/import/batches') return { batches: [] }
      if (path === '/api/admin/import/batches/b1') return { batch: { id: 'b1', source_url: 'https://shop.example/', platform: 'shopify', status: 'ready' }, items }
      throw new Error(`unexpected request ${path}`)
    })
    const props = { authRequest, categories: [{ name: 'Vitamins & supplements' }], onProductsChanged: vi.fn(), setError: vi.fn(), setMessage: vi.fn() }
    render(<ImportPage {...props} />)
    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'https://shop.example/' } })
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
    return { authRequest, ...props }
  }
  async function scanWithUnmount(handlers) {
    const authRequest = vi.fn(async (path, options = {}) => {
      if (handlers[path]) return handlers[path](options)
      if (path === '/api/admin/import/batches') return { batches: [] }
      throw new Error(`unexpected request ${path}`)
    })
    const props = { authRequest, categories: [], onProductsChanged: vi.fn(), setError: vi.fn(), setMessage: vi.fn() }
    const view = render(<ImportPage {...props} />)
    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'https://shop.example/' } })
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
    return { authRequest, ...props, unmount: view.unmount }
  }
  const doneScan = () => ({ batchId: 'b1', added: 1, done: true, platform: 'shopify', limitReached: false })

  it('says so when a scan finds nothing', async () => {
    await scanWith({ '/api/admin/import/scan': () => ({ ...doneScan(), added: 0 }) })
    await waitFor(() => expect(screen.getByText(/No products were found/)).toBeTruthy())
    expect(screen.getByTestId('import-total').textContent).toBe('0')
  })

  it('shows the server message when the scan fails and re-enables Scan', async () => {
    const { setError } = await scanWith({ '/api/admin/import/scan': () => { throw new Error('That website blocked the scan.') } })
    await waitFor(() => expect(setError).toHaveBeenCalledWith('That website blocked the scan.'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Scan' }).disabled).toBe(false))
  })

  it('keeps found items reachable when a later scan step fails', async () => {
    let calls = 0
    const { setError } = await scanWith({
      '/api/admin/import/scan': () => {
        calls += 1
        if (calls === 2) throw new Error('Timed out.')
        return { ...doneScan(), done: false }
      },
    }, [scanned('i1', 'Vitamin C')])
    await waitFor(() => expect(setError).toHaveBeenCalledWith('Timed out.'))
    await waitFor(() => expect(screen.getByTestId('import-total').textContent).toBe('1'))
  })

  it('stops at the step bound when the server never reports done', async () => {
    let calls = 0
    const { setMessage } = await scanWith({
      '/api/admin/import/scan': () => { calls += 1; return { ...doneScan(), added: 0, done: false } },
    })
    await waitFor(() => expect(screen.getByTestId('import-total')).toBeTruthy())
    expect(calls).toBe(60)
    expect(setMessage).toHaveBeenCalledWith(expect.stringMatching(/stopped/i))
  })

  it('disables Scan while scanning', async () => {
    let release
    await scanWith({ '/api/admin/import/scan': () => new Promise((resolve) => { release = () => resolve({ ...doneScan(), added: 0 }) }) })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Scanning…' }).disabled).toBe(true))
    release()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Scan' }).disabled).toBe(false))
  })

  it('keeps the item pending and reports the error when approval fails', async () => {
    const { setError, onProductsChanged } = await scanWith({
      '/api/admin/import/scan': doneScan,
      '/api/admin/import/items/i1/approve': () => { throw new Error('Category does not exist.') },
    }, [scanned('i1', 'Vitamin C')])
    await waitFor(() => expect(screen.getByTestId('import-total').textContent).toBe('1'))
    fireEvent.click(screen.getByRole('button', { name: 'Approve Vitamin C' }))
    await waitFor(() => expect(setError).toHaveBeenCalledWith('Category does not exist.'))
    expect(screen.getByTestId('import-pending').textContent).toBe('1')
    expect(screen.getByTestId('import-approved').textContent).toBe('0')
    expect(onProductsChanged).not.toHaveBeenCalled()
  })

  async function scanTwo(handlers = {}, items) {
    const list = items ?? [scanned('i1', 'Vitamin C'), scanned('i2', 'Zinc')]
    const result = await scanWith({ '/api/admin/import/scan': () => ({ ...doneScan(), added: list.length }), ...handlers }, list)
    await waitFor(() => expect(screen.getByTestId('import-total').textContent).toBe(String(list.length)))
    return result
  }

  it('approves all valid products only after the owner confirms, and mentions flagged duplicates', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { authRequest } = await scanTwo({
      '/api/admin/import/items/i1/approve': () => ({ product: { id: 'a' }, warnings: [] }),
      '/api/admin/import/items/i2/approve': () => ({ product: { id: 'b' }, warnings: [] }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve all valid' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0]).toMatch(/Approve 2 products/)
    expect(confirm.mock.calls[0][0]).toMatch(/1 of them is flagged as already in your store/)
    expect(authRequest.mock.calls.some(([path]) => path.endsWith('/approve'))).toBe(false)

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Approve all valid' }))
    await waitFor(() => expect(screen.getByTestId('import-approved').textContent).toBe('2'))
    confirm.mockRestore()
  })

  it('omits the duplicate note when nothing is flagged and locks the page during a bulk run', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    let release
    await scanTwo({
      '/api/admin/import/items/i1/approve': () => new Promise((resolve) => { release = () => resolve({ product: { id: 'a' }, warnings: [] }) }),
      '/api/admin/import/items/i2/approve': () => ({ product: { id: 'b' }, warnings: [] }),
    }, [scanned('i1', 'Vitamin C'), { ...scanned('i3', 'Zinc'), id: 'i2', duplicate: null }])
    fireEvent.click(screen.getByRole('button', { name: 'Approve all valid' }))
    expect(confirm.mock.calls[0][0]).not.toMatch(/flagged/)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reject Zinc' }).disabled).toBe(true))
    release()
    await waitFor(() => expect(screen.getByTestId('import-approved').textContent).toBe('2'))
    expect(screen.getByRole('button', { name: 'Approve all valid' }).disabled).toBe(true)
    confirm.mockRestore()
  })

  it('stops the bulk run at the first failure and shows its error', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { setError, authRequest } = await scanTwo({
      '/api/admin/import/items/i1/approve': () => { throw new Error('Nope.') },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve all valid' }))
    await waitFor(() => expect(setError).toHaveBeenCalledWith('Nope.'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve all valid' }).disabled).toBe(false))
    expect(authRequest.mock.calls.some(([path]) => path === '/api/admin/import/items/i2/approve')).toBe(false)
    confirm.mockRestore()
  })

  it('does not reject anything when the owner cancels Reject all', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { authRequest } = await scanTwo()
    fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))
    expect(confirm).toHaveBeenCalled()
    expect(authRequest.mock.calls.some(([path]) => path.endsWith('/reject'))).toBe(false)
    confirm.mockRestore()
  })

  it('toggles edit mode', async () => {
    await scanTwo()
    expect(screen.queryByLabelText('Name of Vitamin C')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Vitamin C' }))
    expect(screen.getByLabelText('Name of Vitamin C')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Done editing Vitamin C' }))
    expect(screen.queryByLabelText('Name of Vitamin C')).toBeNull()
  })

  it('shows a note when the site currency is not NGN', async () => {
    const usd = scanned('i1', 'Vitamin C')
    usd.data.currency = 'USD'
    await scanTwo({}, [usd])
    expect(screen.getByText('Site currency: USD')).toBeTruthy()
  })

  it('includes the server warnings in the message after approving', async () => {
    const { setMessage } = await scanTwo({
      '/api/admin/import/items/i1/approve': () => ({ product: { id: 'a' }, warnings: ['A photo could not be copied.'] }),
    }, [scanned('i1', 'Vitamin C')])
    fireEvent.click(screen.getByRole('button', { name: 'Approve Vitamin C' }))
    await waitFor(() => expect(setMessage).toHaveBeenCalledWith('“Vitamin C” was saved. A photo could not be copied.'))
  })

  it('gives same-named products distinct labels and survives duplicate image urls', async () => {
    const a = scanned('i1', 'Zinc')
    a.data.images = ['https://cdn.example/a.jpg', 'https://cdn.example/a.jpg']
    const b = scanned('i2', 'Zinc')
    await scanTwo({}, [a, { ...b, duplicate: null }])
    expect(screen.getByRole('button', { name: 'Approve Zinc (item 1)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Approve Zinc (item 2)' })).toBeTruthy()
    expect(document.querySelectorAll('article')[0].querySelectorAll('img')).toHaveLength(1)
  })

  it('stops scanning and stays quiet after the page is left', async () => {
    let calls = 0
    let release
    const { setMessage, setError, unmount } = await scanWithUnmount({
      '/api/admin/import/scan': () => { calls += 1; return new Promise((resolve) => { release = () => resolve({ ...doneScan(), added: 0, done: false, limitReached: true }) }) },
    })
    await waitFor(() => expect(calls).toBe(1))
    unmount()
    release()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(calls).toBe(1)
    expect(setMessage).not.toHaveBeenCalledWith(expect.stringMatching(/scan limit/))
    expect(setError).not.toHaveBeenCalledWith(expect.stringMatching(/./))
  })

  it('does not render unsafe source links or image URLs', async () => {
    const bad = scanned('i1', 'Evil')
    bad.data.source_url = 'javascript:alert(1)'
    bad.data.images = ['javascript:alert(2)', 'https://cdn.example/ok.jpg']
    await scanWith({ '/api/admin/import/scan': doneScan }, [bad])
    await waitFor(() => expect(screen.getByTestId('import-total').textContent).toBe('1'))
    expect(screen.queryByText(/View on source site/)).toBeNull()
    const images = Array.from(document.querySelectorAll('img'))
    expect(images.map((img) => img.getAttribute('src'))).toEqual(['https://cdn.example/ok.jpg'])
    expect(images[0].getAttribute('referrerpolicy')).toBe('no-referrer')
  })
})
