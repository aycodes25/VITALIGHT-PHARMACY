import { Link } from 'react-router-dom'
import ProductArt from '../../../shared/art/ProductArt.jsx'
import { discountPercent, isInStock } from '../../../shared/catalogTools.js'
import { formatPrice } from '../../../shared/money.js'
import { useStore } from '../context/StoreContext.jsx'
import Icon from './Icon.jsx'

export default function ProductCard({ product }) {
  const { add, toggleSaved, isSaved } = useStore()
  const discount = discountPercent(product)
  const inStock = isInStock(product)
  const saved = isSaved(product.id)

  return (
    <article className="product-card">
      <div className="card-media">
        <Link to={`/product/${product.id}`} aria-label={product.name} tabIndex={-1}>
          <ProductArt type={product.art} color={product.color} imageUrl={product.image_url} name={product.name} />
        </Link>
        <div className="badges">
          {discount > 0 && <span className="badge badge-sale">-{discount}%</span>}
          {product.rx_required && <span className="badge badge-rx">Rx</span>}
          {product.tag && discount === 0 && !product.rx_required && <span className="badge badge-tag">{product.tag}</span>}
        </div>
        <button className={`save-btn ${saved ? 'is-saved' : ''}`} type="button" aria-pressed={saved} aria-label={saved ? `Remove ${product.name} from saved items` : `Save ${product.name}`} onClick={() => toggleSaved(product.id)}>
          <Icon name="heart" size={18} />
        </button>
        {!inStock && <div className="out-of-stock">Out of stock</div>}
      </div>
      <div className="card-body">
        {product.brand && <span className="card-brand">{product.brand}</span>}
        <h3 className="card-title"><Link to={`/product/${product.id}`}>{product.name}</Link></h3>
        <p className="card-detail">{product.detail}</p>
        <div className="card-bottom">
          <span className="price">{formatPrice(product.price)}{discount > 0 && <del>{formatPrice(product.oldPrice)}</del>}</span>
          <button className="add-btn" type="button" disabled={!inStock} aria-label={`Add ${product.name} to basket`} onClick={() => add(product.id)}>
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>
    </article>
  )
}
