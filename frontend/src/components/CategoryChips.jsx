import { Link } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext.jsx'
import { categorySlug } from '../../../shared/catalogTools.js'

export default function CategoryChips() {
  const { categories } = useCatalog()
  return (
    <section className="container section" aria-labelledby="chips-title">
      <div className="section-head">
        <div><p className="eyebrow">Shop by category</p><h2 id="chips-title">Find what you need</h2></div>
      </div>
      <div className="chips">
        {categories.map((category) => (
          <Link key={category.name} className="chip" to={`/category/${categorySlug(category.name)}`}>
            <span className="chip-circle" aria-hidden="true">{category.icon}</span>
            <span className="chip-label">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
