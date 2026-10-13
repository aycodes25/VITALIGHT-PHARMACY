import { Link } from 'react-router-dom'
import HeroVisual from '../components/HeroVisual.jsx'
import { categorySlug, discountPercent, isInStock, sortProducts } from '../../../shared/catalogTools.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import PrescriptionBand from '../components/PrescriptionBand.jsx'
import ProductRail from '../components/ProductRail.jsx'
import Icon from '../components/Icon.jsx'

const concerns = [
  { title: 'Immunity & vitamins', text: 'Everyday nutrition support', to: '/category/vitamins-and-supplements' },
  { title: 'Skin & sun care', text: 'Cleanse, protect, soothe', to: '/category/skin-care-and-dermatology' },
  { title: 'Mum & baby', text: 'Gentle care for little ones', to: '/category/mother-and-baby' },
  { title: 'Heart & diabetes', text: 'Monitor and manage at home', to: '/category/diabetes-and-heart-care' },
]

export default function HomePage() {
  const { products, categories, status } = useCatalog()
  // The starter catalogue stands in while loading; its categories must not drive links that may 404.
  const loading = status === 'loading'
  const existingSlugs = new Set(categories.map((category) => categorySlug(category.name)))
  const visibleConcerns = loading ? [] : concerns.filter((item) => existingSlugs.has(item.to.replace('/category/', '')))
  const available = products.filter(isInStock)
  const deals = sortProducts(available.filter((p) => discountPercent(p) > 0), 'discount').slice(0, 10)
  const bestsellers = sortProducts(available.filter((p) => p.featured), 'featured').slice(0, 10)
  const fresh = available.filter((p) => /\bnew\b|\bjust in\b/i.test(p.tag || ''))
  const arrivals = fresh.slice(0, 10)

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Your neighbourhood pharmacy</p>
            <h1>Care that feels <span>lighter.</span></h1>
            <p className="hero-lede">Trusted medicines, wellness essentials and friendly pharmacist support, ordered online and delivered to you.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/search">Shop all products <Icon name="arrow" size={16} /></Link>
              {!loading && existingSlugs.has('vitamins-and-supplements') && (
                <Link className="btn btn-outline" to="/category/vitamins-and-supplements">Vitamins</Link>
              )}
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="container trust-strip" aria-label="Why Vitalight">
        <div><Icon name="shield" /><span><strong>Quality you can trust</strong><small>Carefully chosen products</small></span></div>
        <div><Icon name="headset" /><span><strong>Pharmacist confirmed</strong><small>Every order is checked</small></span></div>
        <div><Icon name="truck" /><span><strong>Delivered to you</strong><small>Order from anywhere</small></span></div>
      </section>

      <ProductRail eyebrow="Great value" title="Today’s deals" products={deals} to="/search?sale=1" />
      <PrescriptionBand />
      <ProductRail eyebrow="Customer favourites" title="Bestsellers" products={bestsellers} to="/search" />

      {visibleConcerns.length > 0 && (
        <section className="container section">
          <div className="section-head"><div><p className="eyebrow">Shop by concern</p><h2>What are you looking for?</h2></div></div>
          <div className="concerns">
            {visibleConcerns.map((item) => (
              <Link key={item.title} className="concern" to={item.to}>
                <strong>{item.title}</strong><span>{item.text}</span><Icon name="arrow" size={18} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <ProductRail eyebrow="Just in" title="New arrivals" products={arrivals} to="/search" />
    </>
  )
}
