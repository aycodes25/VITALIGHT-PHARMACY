import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import ProductArt from '../../../shared/art/ProductArt.jsx'
import { MAX_QUANTITY } from '../../../shared/cart.js'
import { isInStock } from '../../../shared/catalogTools.js'
import { formatPrice } from '../../../shared/money.js'
import { useStore } from '../context/StoreContext.jsx'
import Icon from './Icon.jsx'

export default function CartDrawer() {
  const { cartOpen, closeCart, lines, totals, setQty, openOrder } = useStore()

  useEffect(() => {
    if (!cartOpen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') closeCart()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [cartOpen, closeCart])

  if (!cartOpen) return null
  const hasUnavailable = lines.some(({ product }) => !isInStock(product))

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCart() }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="drawer-head">
          <h2 id="cart-title">Your basket ({totals.count})</h2>
          <button className="icon-btn" type="button" aria-label="Close basket" onClick={closeCart}><Icon name="close" /></button>
        </div>
        {lines.length === 0 ? (
          <div className="cart-items">
            <p>Your basket is empty.</p>
            <Link className="btn btn-primary" to="/search" onClick={closeCart}>Browse products</Link>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {lines.map(({ product, quantity, lineTotal }) => {
                const available = isInStock(product)
                const limit = Math.min(MAX_QUANTITY, Number.isFinite(Number(product.stock)) ? Number(product.stock) : MAX_QUANTITY)
                const atLimit = quantity >= limit
                return (
                <div className={`cart-item ${available ? '' : 'is-unavailable'}`} key={product.id}>
                  <ProductArt type={product.art} color={product.color} imageUrl={product.image_url} name={product.name} />
                  <div>
                    <strong>{product.name}</strong>
                    <div className="qty" role="group" aria-label={`Quantity of ${product.name}`}>
                      <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => setQty(product.id, quantity - 1)}><Icon name="minus" size={14} /></button>
                      <span>{quantity}</span>
                      <button type="button" aria-label={`Add one ${product.name}`} disabled={atLimit} onClick={() => setQty(product.id, quantity + 1)}><Icon name="plus" size={14} /></button>
                    </div>
                    {!available
                      ? <p className="stock out">Out of stock</p>
                      : product.stock <= quantity && <p className="stock out">Only {product.stock} available</p>}
                  </div>
                  <strong>{formatPrice(lineTotal)}</strong>
                </div>
                )
              })}
            </div>
            <div className="cart-summary">
              {totals.hasRx && (
                <p className="notice">Your basket includes prescription medicines. Our pharmacist will verify your prescription before dispatch.</p>
              )}
              {hasUnavailable && <p className="notice">Remove out-of-stock items to continue with your order request.</p>}
              <div className="row"><span>Estimated total</span><strong className="price">{formatPrice(totals.total)}</strong></div>
              <p style={{ fontSize: 13 }}>Our team confirms availability, final price and delivery before fulfilment.</p>
              <button className="btn btn-primary btn-block" type="button" disabled={hasUnavailable} onClick={openOrder}>Request this order <Icon name="arrow" size={16} /></button>
              <button className="btn btn-outline btn-block" type="button" onClick={closeCart}>Keep browsing</button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
