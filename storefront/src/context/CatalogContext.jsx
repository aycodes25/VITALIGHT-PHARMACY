import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { categories as starterCategories, products as starterProducts } from '../../../shared/catalog.js'
import { findCategoryBySlug } from '../../../shared/catalogTools.js'
import { fetchCatalog } from '../api.js'

const CatalogContext = createContext(null)

export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState({ products: starterProducts, categories: starterCategories })
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()
    fetchCatalog(controller.signal)
      .then((result) => {
        setCatalog({
          products: Array.isArray(result.products) && result.products.length ? result.products : starterProducts,
          categories: Array.isArray(result.categories) && result.categories.length ? result.categories : starterCategories,
        })
        setStatus('live')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('sample')
      })
    return () => controller.abort()
  }, [])

  const value = useMemo(() => {
    const byId = new Map(catalog.products.map((product) => [product.id, product]))
    return {
      ...catalog,
      status,
      productById: (id) => byId.get(id) ?? null,
      categoryBySlug: (slug) => findCategoryBySlug(catalog.categories, slug),
    }
  }, [catalog, status])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const value = useContext(CatalogContext)
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider')
  return value
}
