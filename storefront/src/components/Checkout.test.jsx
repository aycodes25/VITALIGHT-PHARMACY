// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider, useStore } from '../context/StoreContext.jsx'
import CartDrawer from './CartDrawer.jsx'
import OrderModal from './OrderModal.jsx'

function Controls() {
  const { add, openCart, totals } = useStore()
  return (
    <>
      <button onClick={() => add('paracetamol-500mg', 2)}>add-otc</button>
      <button onClick={() => add('amoxicillin-500mg')}>add-rx</button>
      <button onClick={openCart}>open</button>
      <span data-testid="count">{totals.count}</span>
    </>
  )
}

function setup() {
  return render(
    <MemoryRouter>
      <CatalogProvider><StoreProvider><Controls /><CartDrawer /><OrderModal /></StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('cart drawer', () => {
  it('shows an empty state', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup()
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByText(/Your basket is empty/)).toBeTruthy()
  })
  it('lists items, shows total and updates quantity', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup()
    fireEvent.click(screen.getByText('add-otc'))
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByText('Paracetamol 500 mg Tablets')).toBeTruthy()
    expect(screen.getAllByText('₦2,400').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByLabelText('Remove one Paracetamol 500 mg Tablets'))
    expect(screen.getByTestId('count').textContent).toBe('1')
  })
  it('warns about prescription items', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup()
    fireEvent.click(screen.getByText('add-rx'))
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByText(/prescription medicines/i)).toBeTruthy()
  })
})

describe('cart drawer extras', () => {
  it('decrementing a quantity-1 line removes it', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup()
    fireEvent.click(screen.getByText('add-rx'))
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByRole('button', { name: /^Remove one / }))
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByText(/Your basket is empty/)).toBeTruthy()
  })
  it('closes on Escape', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup()
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('order request', () => {
  it('shows the Rx notice inside the order modal', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup()
    fireEvent.click(screen.getByText('add-rx'))
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByRole('button', { name: /Request this order/ }))
    const modal = screen.getByRole('dialog', { name: 'Request your order' })
    expect(within(modal).getByText(/verified by our pharmacist/i)).toBeTruthy()
  })
  it('closes the order modal on Escape', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup()
    fireEvent.click(screen.getByText('add-otc'))
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByRole('button', { name: /Request this order/ }))
    expect(screen.getByRole('dialog', { name: 'Request your order' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Request your order' })).toBeNull()
  })
  it('sends only one request on double submit', async () => {
    let release
    const pending = new Promise((resolve) => { release = resolve })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog') throw new Error('offline')
      await pending
      return { ok: true, json: async () => ({ orderId: 'abc' }) }
    })
    setup()
    fireEvent.click(screen.getByText('add-otc'))
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByRole('button', { name: /Request this order/ }))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada Okafor' } })
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+234 800 000 0000' } })
    fireEvent.change(screen.getByLabelText('Delivery address'), { target: { value: '12 Example Street' } })
    const submit = screen.getByRole('button', { name: /Send order request/ })
    fireEvent.click(submit)
    const sending = await screen.findByRole('button', { name: /Sending your request/ })
    expect(sending.disabled).toBe(true)
    fireEvent.click(sending)
    fireEvent.submit(sending.closest('form'))
    release()
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/orders')).toHaveLength(1)
  })
  it('submits the order and clears the basket', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog') throw new Error('offline')
      return { ok: true, json: async () => ({ orderId: 'abc' }) }
    })
    setup()
    fireEvent.click(screen.getByText('add-otc'))
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByRole('button', { name: /Request this order/ }))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada Okafor' } })
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+234 800 000 0000' } })
    fireEvent.change(screen.getByLabelText('Delivery address'), { target: { value: '12 Example Street' } })
    fireEvent.click(screen.getByRole('button', { name: /Send order request/ }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
    const orderCall = fetchMock.mock.calls.find(([url]) => url === '/api/orders')
    expect(JSON.parse(orderCall[1].body)).toEqual({
      name: 'Ada Okafor', phone: '+234 800 000 0000', address: '12 Example Street',
      items: [{ productId: 'paracetamol-500mg', quantity: 2 }],
    })
  })
  it('shows the server error and keeps the basket', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog') throw new Error('offline')
      return { ok: false, json: async () => ({ error: 'Out of stock somewhere' }) }
    })
    setup()
    fireEvent.click(screen.getByText('add-otc'))
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByRole('button', { name: /Request this order/ }))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada Okafor' } })
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+234 800 000 0000' } })
    fireEvent.change(screen.getByLabelText('Delivery address'), { target: { value: '12 Example Street' } })
    fireEvent.click(screen.getByRole('button', { name: /Send order request/ }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Out of stock somewhere/))
    expect(screen.getByTestId('count').textContent).toBe('2')
  })
})
