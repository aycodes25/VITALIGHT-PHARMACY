import { useEffect, useRef, useState } from 'react'
import { submitOrder } from '../api.js'
import { formatPrice } from '../../../shared/money.js'
import { useStore } from '../context/StoreContext.jsx'
import Icon from './Icon.jsx'

const emptyForm = { name: '', phone: '', address: '' }

export default function OrderModal() {
  const { orderOpen, closeOrder, lines, totals, clearCart, notify } = useStore()
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  useEffect(() => {
    if (!orderOpen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') closeOrder()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      setError('')
    }
  }, [orderOpen, closeOrder])

  if (!orderOpen) return null

  async function onSubmit(event) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setError('')
    try {
      await submitOrder({
        ...form,
        items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      })
      clearCart()
      setForm(emptyForm)
      closeOrder()
      notify('Order request received. We’ll be in touch soon.')
    } catch (submitError) {
      setError(submitError.message || 'We could not submit your request. Please try again.')
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="overlay center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeOrder() }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="order-title">
        <div className="row">
          <h2 id="order-title">Request your order</h2>
          <button className="icon-btn" type="button" aria-label="Close order form" onClick={closeOrder}><Icon name="close" /></button>
        </div>
        <p style={{ marginTop: 8 }}>Share your details and our team will confirm availability, delivery and pricing.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>Your name<input autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Ada Okafor" /></label>
          <label>Phone number<input autoComplete="tel" required type="tel" pattern="[+0-9\(\)\- ]{7,25}" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+234 800 000 0000" /></label>
          <label>Delivery address<textarea autoComplete="street-address" required minLength={5} maxLength={500} rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Where should we deliver?" /></label>
          <div className="row"><span>{totals.count} {totals.count === 1 ? 'item' : 'items'} · estimated total</span><strong className="price">{formatPrice(totals.total)}</strong></div>
          {totals.hasRx && <p className="notice">Prescription medicines are verified by our pharmacist before dispatch.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting || lines.length === 0}>{submitting ? 'Sending your request…' : 'Send order request'}</button>
          <p style={{ fontSize: 13 }}>This is an order request, not a payment. We’ll contact you to confirm your order.</p>
        </form>
      </section>
    </div>
  )
}
