import { useEffect, useRef, useState } from 'react'
import { fetchProfile, saveProfile, submitOrder } from '../api.js'
import { formatPrice } from '../../../shared/money.js'
import { buildOrderMessage, whatsAppLink } from '../../../shared/whatsapp.js'
import { contact } from '../config.js'
import { useStore } from '../context/StoreContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icon.jsx'
import SignInPrompt from './SignInPrompt.jsx'

const emptyForm = { name: '', phone: '', address: '' }

export default function OrderModal() {
  const { orderOpen, closeOrder: closeStoreOrder, lines, totals, clearCart, notify } = useStore()
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState(null)
  const inFlight = useRef(false)
  const { configured, loading, user, session } = useAuth()
  const token = session?.access_token ?? ''

  // Signed-in customers get their saved details prefilled (never overwriting what they typed).
  useEffect(() => {
    if (!orderOpen || !token) return undefined
    let cancelled = false
    fetchProfile(token).then((profile) => {
      if (cancelled) return
      setForm((current) => ({
        name: current.name || profile.name || user?.user_metadata?.full_name || '',
        phone: current.phone || profile.phone || '',
        address: current.address || profile.address || '',
      }))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [orderOpen, token, user])

  function closeOrder() {
    setPlaced(null)
    closeStoreOrder()
  }

  useEffect(() => {
    if (!orderOpen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') { setPlaced(null); closeStoreOrder() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      setError('')
    }
  }, [orderOpen, closeStoreOrder])

  if (!orderOpen) return null
  if (configured && !loading && !user) return <SignInPrompt onClose={closeOrder} />

  async function onSubmit(event) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setError('')
    try {
      const summary = { ...form, lines, total: totals.total, hasRx: totals.hasRx }
      const result = await submitOrder({
        ...form,
        items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      }, token)
      if (token) saveProfile(token, { name: form.name, phone: form.phone, address: form.address }).catch(() => {})
      setPlaced({ ...summary, orderId: result?.orderId || '' })
      clearCart()
      setForm(emptyForm)
      notify('Order request received. We’ll be in touch soon.')
    } catch (submitError) {
      setError(submitError.message || 'We could not submit your request. Please try again.')
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  if (placed) {
    const reference = placed.orderId ? String(placed.orderId).slice(0, 8).toUpperCase() : ''
    const href = whatsAppLink(contact.whatsapp, buildOrderMessage(placed))
    return (
      <div className="overlay center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeOrder() }}>
        <section className="modal order-success" role="dialog" aria-modal="true" aria-labelledby="order-title">
          <h2 id="order-title">Order request received</h2>
          {reference && <p style={{ marginTop: 8 }}>Reference: <strong>#{reference}</strong></p>}
          <p style={{ marginTop: 8 }}>Our pharmacy team will confirm availability, delivery and pricing with you shortly.</p>
          {href && (
            <>
              <p style={{ marginTop: 8 }}>Tap the button to send your order details straight to our customer care on WhatsApp so we can confirm it faster.</p>
              <a className="btn btn-primary btn-block" href={href} target="_blank" rel="noopener noreferrer">Send order on WhatsApp</a>
            </>
          )}
          <button className="btn btn-outline btn-block" type="button" onClick={closeOrder}>Done</button>
        </section>
      </div>
    )
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
          <label>Your name<input autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Ayomide Tominiyi" /></label>
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
