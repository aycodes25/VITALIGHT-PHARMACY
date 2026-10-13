import { Link } from 'react-router-dom'
import ProductCard from './ProductCard.jsx'
import Icon from './Icon.jsx'

export default function ProductRail({ eyebrow, title, products, to }) {
  if (!products.length) return null
  return (
    <section className="container section">
      <div className="section-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {to && <Link className="text-link" to={to}>See all <Icon name="arrow" size={14} /></Link>}
      </div>
      <div className="rail">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  )
}
