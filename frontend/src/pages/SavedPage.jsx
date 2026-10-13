import { Link } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import ProductGrid from '../components/ProductGrid.jsx'

export default function SavedPage() {
  const { products } = useCatalog()
  const { saved } = useStore()
  const items = products.filter((product) => saved.includes(product.id))
  return (
    <section className="container section">
      <div className="section-head"><div><p className="eyebrow">Your list</p><h1 className="page-title">Saved items</h1></div></div>
      {items.length
        ? <ProductGrid products={items} />
        : <p className="notice">You haven’t saved anything yet. Tap the heart on a product to keep it here. <Link className="text-link" to="/search">Browse products</Link></p>}
    </section>
  )
}
