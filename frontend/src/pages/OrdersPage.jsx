import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyOrders } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatPrice } from '../../../shared/money.js'
import AccountShell from '../components/AccountShell.jsx'

const STATUS_LABELS = {
  new: 'Received',
  contacted: 'Pharmacy in touch',
  fulfilled: 'Completed',
  cancelled: 'Cancelled',
}

export default function OrdersPage() {
  const { session } = useAuth()
  const { products } = useCatalog()
  const { add, openCart } = useStore()
  const token = session?.access_token
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    fetchMyOrders(token)
      .then((data) => { if (!cancelled) setOrders(data.orders) })
      .catch((loadError) => { if (!cancelled) setError(loadError.message) })
    return () => { cancelled = true }
  }, [token])

  const available = new Set(products.map((product) => product.id))

  function reorder(order) {
    for (const item of order.items) {
      if (available.has(item.productId)) add(item.productId, item.quantity)
    }
    openCart()
  }

  return (
    <AccountShell title="Order history">
      {error && <p className="form-error" role="alert">{error}</p>}
      {!error && orders === null && <p>Loading your orders…</p>}
      {orders && orders.length === 0 && (
        <p className="notice">You have not placed an order yet. <Link className="text-link" to="/search">Start shopping</Link></p>
      )}
      {orders && orders.length > 0 && (
        <ul className="order-list">
          {orders.map((order) => {
            const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
            const canReorder = order.items.some((item) => available.has(item.productId))
            return (
              <li key={order.id} className="order-card">
                <div className="order-head">
                  <div>
                    <strong>Order #{String(order.id).slice(0, 8).toUpperCase()}</strong>
                    <small>{new Date(order.createdAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}</small>
                  </div>
                  <span className={`status-pill status-${order.status}`}>{STATUS_LABELS[order.status] || order.status}</span>
                </div>
                <ul className="order-items">
                  {order.items.map((item) => (
                    <li key={item.productId}>
                      <span>{item.quantity} × {item.name}</span>
                      <span>{formatPrice(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="order-foot">
                  <span>Estimated total <strong>{formatPrice(total)}</strong></span>
                  {canReorder && <button className="btn btn-outline" type="button" onClick={() => reorder(order)}>Order again</button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </AccountShell>
  )
}
