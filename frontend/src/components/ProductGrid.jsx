import ProductCard from './ProductCard.jsx'

export default function ProductGrid({ products, emptyText = 'No products found.' }) {
  if (!products.length) return <p className="notice">{emptyText}</p>
  return (
    <div className="product-grid">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  )
}
