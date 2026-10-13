import { Link } from 'react-router-dom'
import logo from '../../../shared/assets/logo.png'
import { contact } from '../config.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import { categorySlug } from '../../../shared/catalogTools.js'

export default function Footer() {
  const { categories } = useCatalog()
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link className="brand" to="/"><img src={logo} alt="" /><span className="brand-name" style={{ color: '#fff' }}>VITALIGHT<small style={{ color: '#9fb0c8' }}>PHARMACY</small></span></Link>
          <p style={{ marginTop: 14 }}>Your health, our priority. A little more care in every day.</p>
        </div>
        <div>
          <h3>Shop</h3>
          {categories.slice(0, 6).map((category) => (
            <Link key={category.name} to={`/category/${categorySlug(category.name)}`}>{category.name}</Link>
          ))}
        </div>
        <div>
          <h3>Help</h3>
          <Link to="/search">Browse all products</Link>
          <Link to="/saved">Saved items</Link>
          <a href="/admin">Admin sign in</a>
        </div>
        <div>
          <h3>Talk to us</h3>
          {contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
          {contact.whatsapp && <a href={`https://wa.me/${contact.whatsapp}`}>WhatsApp</a>}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Vitalight Pharmacy</span>
        <span>Always follow the advice of your healthcare professional.</span>
      </div>
    </footer>
  )
}
