import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext.jsx'
import CatalogBrowser from '../components/CatalogBrowser.jsx'
import NotFoundPage from './NotFoundPage.jsx'

export default function CategoryPage() {
  const { slug } = useParams()
  const { products, categoryBySlug } = useCatalog()
  const category = categoryBySlug(slug)
  const categoryName = category?.name
  const items = useMemo(
    () => products.filter((product) => product.category === categoryName),
    [products, categoryName],
  )
  if (!category) return <NotFoundPage />
  return (
    <>
      <div className="container breadcrumb"><Link to="/">Home</Link> / <span>{category.name}</span></div>
      <CatalogBrowser key={category.name} eyebrow={category.description} title={category.name} products={items} />
    </>
  )
}
