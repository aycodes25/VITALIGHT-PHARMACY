import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ProductArt from '../../../shared/art/ProductArt.jsx'
import { MAX_QUANTITY } from '../../../shared/cart.js'
import { categorySlug, discountPercent, isInStock, relatedProducts } from '../../../shared/catalogTools.js'
import { formatPrice } from '../../../shared/money.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import ProductRail from '../components/ProductRail.jsx'
import Icon from '../components/Icon.jsx'
import NotFoundPage from './NotFoundPage.jsx'

export default function ProductPage() {
  const { id } = useParams()
  const { products, productById } = useCatalog()
  const { add, toggleSaved, isSaved } = useStore()
  const [quantity, setQuantity] = useState(1)
  const product = productById(id)
  if (!product) return <NotFoundPage />

  const discount = discountPercent(product)
  const inStock = isInStock(product)
  const maxQuantity = Math.min(MAX_QUANTITY, Number(product.stock) || 1)
  const saved = isSaved(product.id)
  const related = relatedProducts(products, product)

  return (
    <>
      <div className="container breadcrumb">
        <Link to="/">Home</Link> / <Link to={`/category/${categorySlug(product.category)}`}>{product.category}</Link> / <span>{product.name}</span>
      </div>
      <section className="container product-detail">
        <ProductArt className="detail-art" type={product.art} color={product.color} imageUrl={product.image_url} name={product.name} />
        <div className="detail-info">
          {product.brand && <p className="card-brand">{product.brand}</p>}
          <h1>{product.name}</h1>
          <p className="detail-text">{product.detail}</p>
          <p className="detail-price">
            <span className="price big">{formatPrice(product.price)}</span>
            {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
            {discount > 0 && <span className="badge badge-sale">-{discount}%</span>}
          </p>
          <p className={`stock ${inStock ? 'in' : 'out'}`}>
            {!inStock ? 'Out of stock' : product.stock <= 5 ? `Only ${product.stock} left in stock` : 'In stock'}
          </p>
          {product.rx_required && (
            <p className="notice">
              <strong>Prescription medicine.</strong> Our pharmacist will verify your prescription before this item is dispatched.
            </p>
          )}
          <div className="detail-actions">
            <div className="qty" role="group" aria-label="Quantity">
              <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}><Icon name="minus" size={14} /></button>
              <span>{quantity}</span>
              <button type="button" aria-label="Increase quantity" disabled={quantity >= maxQuantity} onClick={() => setQuantity(quantity + 1)}><Icon name="plus" size={14} /></button>
            </div>
            <button className="btn btn-primary" type="button" disabled={!inStock} onClick={() => add(product.id, quantity)}>Add to basket</button>
            <button className={`icon-btn ${saved ? 'is-saved' : ''}`} type="button" aria-pressed={saved} aria-label={saved ? 'Remove from saved items' : 'Save for later'} onClick={() => toggleSaved(product.id)}>
              <Icon name="heart" />
            </button>
          </div>
          <p className="detail-note">Orders are requests. Our team confirms availability, final price and delivery with you before fulfilment.</p>
        </div>
      </section>
      <ProductRail eyebrow="You may also like" title="Related products" products={related} to={`/category/${categorySlug(product.category)}`} />
    </>
  )
}
