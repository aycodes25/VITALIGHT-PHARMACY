import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { filterProducts } from '../../../shared/catalogTools.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import CatalogBrowser from '../components/CatalogBrowser.jsx'

export default function SearchPage() {
  const { products } = useCatalog()
  const [params] = useSearchParams()
  const query = params.get('q') || ''
  const sale = params.get('sale') === '1'
  const items = useMemo(() => filterProducts(products, { query }), [products, query])
  return (
    <CatalogBrowser
      key={`${query}|${sale}`}
      eyebrow={query ? 'Search results' : 'Everything we stock'}
      title={query ? `Results for “${query}”` : sale ? 'Deals and offers' : 'All products'}
      products={items}
      initialFilters={{ onSaleOnly: sale }}
    />
  )
}
