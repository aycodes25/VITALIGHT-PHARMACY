import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../../shared/assets/logo.png'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { categorySlug, filterProducts } from '../../../shared/catalogTools.js'
import { formatPrice } from '../../../shared/money.js'
import Icon from './Icon.jsx'

export default function Header() {
  const { categories, products } = useCatalog()
  const { totals, saved, openCart } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  useEffect(() => { setMenuOpen(false); setFocused(false) }, [location.pathname, location.search])
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { setMenuOpen(false); setFocused(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const suggestions = useMemo(
    () => (query.trim().length >= 2 ? filterProducts(products, { query }).slice(0, 5) : []),
    [products, query],
  )

  function submit(event) {
    event.preventDefault()
    const value = query.trim()
    if (value) navigate(`/search?q=${encodeURIComponent(value)}`)
  }

  return (
    <>
      <div className="announcement">Your health, our priority. Order online and our pharmacist confirms every request.</div>
      <header className="site-header">
        <div className="container header-main">
          <button className="icon-btn menu-toggle" type="button" aria-label={menuOpen ? 'Close categories' : 'Open categories'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <Link className="brand" to="/" aria-label="Vitalight Pharmacy home">
            <img src={logo} alt="" />
            <span className="brand-name">VITALIGHT<small>PHARMACY</small></span>
          </Link>
          <form className="search" role="search" onSubmit={submit}>
            <span className="search-icon"><Icon name="search" size={18} /></span>
            <input
              aria-label="Search products"
              placeholder="Search medicines, vitamins, skin care…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            />
            {focused && suggestions.length > 0 && (
              <ul className="suggestions">
                {suggestions.map((product) => (
                  <li key={product.id}>
                    <Link to={`/product/${product.id}`}><span>{product.name}</span><strong>{formatPrice(product.price)}</strong></Link>
                  </li>
                ))}
              </ul>
            )}
          </form>
          <div className="header-actions">
            <Link className="icon-btn" to="/saved" aria-label={`Saved items, ${saved.length}`}>
              <Icon name="heart" />{saved.length > 0 && <span className="count-badge">{saved.length}</span>}
            </Link>
            <button className="icon-btn" type="button" aria-label={`Open basket, ${totals.count} items`} onClick={openCart}>
              <Icon name="cart" /><span className="count-badge">{totals.count}</span>
            </button>
          </div>
        </div>
        <nav className="category-nav" aria-label="Categories">
          <div className="container category-nav-inner">
            <button className="all-categories" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              <Icon name="menu" size={16} /> All categories
            </button>
            {categories.map((category) => (
              <NavLink key={category.name} to={`/category/${categorySlug(category.name)}`} className={({ isActive }) => (isActive ? 'active' : '')}>
                {category.name}
              </NavLink>
            ))}
          </div>
        </nav>
        {menuOpen && (
          <div className="mega" role="region" aria-label="All categories">
            <div className="container mega-grid">
              {categories.map((category) => (
                <Link key={category.name} className="mega-item" to={`/category/${categorySlug(category.name)}`}>
                  <span className="mega-glyph" aria-hidden="true">{category.icon}</span>
                  <span><strong>{category.name}</strong><small>{category.description}</small></span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>
    </>
  )
}
