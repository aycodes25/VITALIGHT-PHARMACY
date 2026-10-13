import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import ProductGrid from '../components/ProductGrid.jsx'

export default function SavedPage() {
  const { products } = useCatalog()
  const { saved } = useStore()
  const { configured, loading, user } = useAuth()
  const location = useLocation()
  if (configured && loading) return <section className="container section"><p>Loading…</p></section>
  if (configured && !user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
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
