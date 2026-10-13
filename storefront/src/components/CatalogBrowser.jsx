import { useEffect, useMemo, useState } from 'react'
import { brandsOf, filterProducts, paginate, sortProducts } from '../../../shared/catalogTools.js'
import ProductGrid from './ProductGrid.jsx'
import Pagination from './Pagination.jsx'

const PER_PAGE = 12

export default function CatalogBrowser({ eyebrow, title, products, initialFilters = {} }) {
  const [inStockOnly, setInStockOnly] = useState(Boolean(initialFilters.inStockOnly))
  const [onSaleOnly, setOnSaleOnly] = useState(Boolean(initialFilters.onSaleOnly))
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [brands, setBrands] = useState([])
  const [sort, setSort] = useState('featured')
  const [page, setPage] = useState(1)

  const allBrands = useMemo(() => brandsOf(products), [products])

  const filtered = useMemo(() => sortProducts(filterProducts(products, {
    inStockOnly,
    onSaleOnly,
    minPrice: minPrice === '' ? undefined : Number(minPrice),
    maxPrice: maxPrice === '' ? undefined : Number(maxPrice),
    brands,
  }), sort), [products, inStockOnly, onSaleOnly, minPrice, maxPrice, brands, sort])

  useEffect(() => setPage(1), [inStockOnly, onSaleOnly, minPrice, maxPrice, brands, sort, products])

  const view = paginate(filtered, page, PER_PAGE)

  function toggleBrand(brand) {
    setBrands((current) => (current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand]))
  }

  return (
    <section className="container section browser">
      <div className="section-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="page-title">{title}</h1>
        </div>
        <label className="sort">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="discount">Biggest discount</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>
      <div className="browser-layout">
        <aside className="filters" aria-label="Filters">
          <fieldset>
            <legend>Availability</legend>
            <label className="check"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} /> In stock</label>
            <label className="check"><input type="checkbox" checked={onSaleOnly} onChange={(event) => setOnSaleOnly(event.target.checked)} /> On sale</label>
          </fieldset>
          <fieldset>
            <legend>Price (₦)</legend>
            <div className="price-inputs">
              <input type="number" min="0" inputMode="numeric" placeholder="Min" aria-label="Minimum price" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
              <input type="number" min="0" inputMode="numeric" placeholder="Max" aria-label="Maximum price" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
            </div>
          </fieldset>
          {allBrands.length > 1 && (
            <fieldset>
              <legend>Brand</legend>
              {allBrands.map((brand) => (
                <label className="check" key={brand}><input type="checkbox" checked={brands.includes(brand)} onChange={() => toggleBrand(brand)} /> {brand}</label>
              ))}
            </fieldset>
          )}
        </aside>
        <div>
          <p className="result-count" aria-live="polite">{view.total} {view.total === 1 ? 'product' : 'products'}</p>
          <ProductGrid products={view.items} emptyText="No products match these filters. Try clearing a filter or searching for something else." />
          <Pagination page={view.page} pages={view.pages} onChange={(next) => { setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </div>
      </div>
    </section>
  )
}
