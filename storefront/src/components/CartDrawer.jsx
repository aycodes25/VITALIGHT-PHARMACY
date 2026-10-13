import { Link } from 'react-router-dom'
import ProductArt from '../../../shared/art/ProductArt.jsx'
import { formatPrice } from '../../../shared/money.js'
import { useStore } from '../context/StoreContext.jsx'
import Icon from './Icon.jsx'

export default function CartDrawer() {
  const { cartOpen, closeCart, lines, totals, setQty, openOrder } = useStore()
  if (!cartOpen) return null

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
              {lines.map(({ product, quantity, lineTotal }) => (
                <div className="cart-item" key={product.id}>
                  <ProductArt type={product.art} color={product.color} imageUrl={product.image_url} name={product.name} />
                  <div>
                    <strong>{product.name}</strong>
                    <div className="qty" role="group" aria-label={`Quantity of ${product.name}`}>
                      <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => setQty(product.id, quantity - 1)}><Icon name="minus" size={14} /></button>
                      <span>{quantity}</span>
                      <button type="button" aria-label={`Add one ${product.name}`} onClick={() => setQty(product.id, quantity + 1)}><Icon name="plus" size={14} /></button>
                    </div>
                  </div>
                  <strong>{formatPrice(lineTotal)}</strong>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              {totals.hasRx && (
                <p className="notice">Your basket includes prescription medicines. Our pharmacist will verify your prescription before dispatch.</p>
              )}
              <div className="row"><span>Estimated total</span><strong className="price">{formatPrice(totals.total)}</strong></div>
              <p style={{ fontSize: 13 }}>Our team confirms availability, final price and delivery before fulfilment.</p>
              <button className="btn btn-primary btn-block" type="button" onClick={openOrder}>Request this order <Icon name="arrow" size={16} /></button>
              <button className="btn btn-outline btn-block" type="button" onClick={closeCart}>Keep browsing</button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
