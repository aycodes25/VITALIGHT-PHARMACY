import { useEffect, useMemo, useState } from 'react'
import logo from '../vitalight logo.png'
import { categories as starterCategories, products as starterProducts } from './catalog.js'

function Icon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    cart: <><path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    heart: <path d="M20.8 8.8c0 5.1-8.8 10.3-8.8 10.3S3.2 13.9 3.2 8.8A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.7Z" />,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="17.5" cy="18" r="1.5" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    headset: <><path d="M3 13v-2a9 9 0 0 1 18 0v2" /><path d="M3 13h4v7H5a2 2 0 0 1-2-2zM21 13h-4v7h2a2 2 0 0 0 2-2z" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function formatPrice(price) {
  return `₦${price.toLocaleString('en-NG')}`
}

function ProductArtwork({ type, color, imageUrl, name }) {
  return (
    <div className={`product-art ${color}`} aria-hidden="true">
      {imageUrl && <img className="catalogue-image" src={imageUrl} alt={name || ''} />}
      {!imageUrl && <>
      <span className="art-spark art-spark-one">✳</span>
      <span className="art-spark art-spark-two">✧</span>
      {type === 'firstaid' ? (
        <div className="aid-box"><span className="aid-cross">+</span><span className="aid-label">CARE KIT</span></div>
      ) : type === 'device' ? (
        <div className="thermometer"><span /><i /></div>
      ) : type === 'cleanser' ? (
        <div className="bottle cleanser-bottle"><i /><b /><span className="bottle-copy">PURE<br />& gentle</span></div>
      ) : (
        <div className={`bottle ${type === 'vitaminc' || type === 'omega' ? 'wide-bottle' : ''}`}>
          <i />
          <b />
          <span className="bottle-copy">{type === 'omega' ? 'OMEGA 3' : type === 'vitaminc' ? 'VITAMIN C' : type === 'medicine' ? 'ORAL<br />REHYDRATION' : 'DAILY<br />VITALITY'}</span>
        </div>
      )}
      </>}
    </div>
  )
}

function ProductCard({ product, isSaved, onAdd, onSave }) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <ProductArtwork type={product.art} color={product.color} imageUrl={product.image_url} name={product.name} />
        <span className="product-tag">{product.tag}</span>
        <button className={`save-button ${isSaved ? 'is-saved' : ''}`} type="button" aria-label={isSaved ? `Remove ${product.name} from saved items` : `Save ${product.name}`} onClick={() => onSave(product.id)}>
          <Icon name="heart" size={18} />
        </button>
      </div>
      <div className="product-info">
        <p className="product-category">{product.category}</p>
        <h3>{product.name}</h3>
        <p className="product-detail">{product.detail}</p>
        <div className="product-bottom">
          <div className="price-group"><strong>{formatPrice(product.price)}</strong>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}</div>
          <button className="add-button" type="button" aria-label={`Add ${product.name} to cart`} onClick={() => onAdd(product.id)}><Icon name="plus" size={17} /></button>
        </div>
      </div>
    </article>
  )
}

function App() {
  const [products, setProducts] = useState(starterProducts)
  const [categories, setCategories] = useState(starterCategories)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [cart, setCart] = useState({})
  const [saved, setSaved] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/catalog')
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || 'The live catalogue could not be loaded.')
        }
        return response.json()
      })
      .then((result) => {
        if (!active) return
        if (Array.isArray(result.products)) setProducts(result.products)
        if (Array.isArray(result.categories)) setCategories(result.categories)
      })
      .catch((error) => {
        if (active) {
          console.error('Unable to load the pharmacy catalogue:', error)
          showNotice('Showing the sample catalogue. Live stock is not available right now.')
        }
      })
    return () => { active = false }
  }, [])

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.category} ${product.detail}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesCategory = activeCategory === 'All' || product.category === activeCategory || (activeCategory === 'Medicines' && product.category === 'Medicines')
    return matchesQuery && matchesCategory
  }), [activeCategory, query])

  const cartProducts = products.filter((product) => cart[product.id])
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  const cartTotal = cartProducts.reduce((sum, product) => sum + product.price * cart[product.id], 0)

  function showNotice(message) {
    setNotice(message)
    window.clearTimeout(showNotice.timeout)
    showNotice.timeout = window.setTimeout(() => setNotice(''), 3000)
  }

  function addToCart(id) {
    setCart((current) => ({ ...current, [id]: (current[id] || 0) + 1 }))
    showNotice('Added to your basket')
  }

  function changeQuantity(id, change) {
    setCart((current) => {
      const quantity = (current[id] || 0) + change
      if (quantity < 1) {
        const next = { ...current }
        delete next[id]
        return next
      }
      return { ...current, [id]: quantity }
    })
  }

  function toggleSaved(id) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    showNotice(saved.includes(id) ? 'Removed from saved items' : 'Saved for later')
  }

  function chooseCategory(category) {
    setActiveCategory(category)
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function submitOrder(event) {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: cartProducts.map((product) => ({ productId: product.id, quantity: cart[product.id] })),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'We could not submit your request.')
      setCart({})
      setForm({ name: '', phone: '', address: '' })
      setOrderOpen(false)
      setCartOpen(false)
      showNotice('Order request received — we’ll be in touch soon.')
    } catch (error) {
      setFormError(error.message || 'We could not submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function startOrder() {
    setCartOpen(false)
    setOrderOpen(true)
    setFormError('')
  }

  return (
    <>
      <div className="announcement"><span className="announcement-dot" /> A little care goes a long way. <a href="#care">Explore everyday wellness <Icon name="arrow" size={14} /></a></div>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#" aria-label="Vitalight Pharmacy home">
            <img src={logo} alt="" />
            <span className="brand-name">VITALIGHT<span>PHARMACY</span></span>
          </a>
          <nav className={`main-nav ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            <a href="#shop" onClick={() => setMobileMenuOpen(false)}>Shop</a>
            <a href="#categories" onClick={() => setMobileMenuOpen(false)}>Categories</a>
            <a href="#care" onClick={() => setMobileMenuOpen(false)}>Our promise</a>
            <a href="#footer" onClick={() => setMobileMenuOpen(false)}>Contact</a>
          </nav>
          <div className="header-actions">
            <label className="search-box">
              <Icon name="search" size={19} />
              <input aria-label="Search products" placeholder="Search medicines, wellness..." value={query} onChange={(event) => { setQuery(event.target.value); setActiveCategory('All') }} />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button saved-header" type="button" aria-label={`Saved items, ${saved.length}`} onClick={() => { setActiveCategory('All'); setQuery(''); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); showNotice(saved.length ? `${saved.length} item${saved.length === 1 ? '' : 's'} saved` : 'Save products you love with the heart icon') }}>
              <Icon name="heart" size={21} />{saved.length > 0 && <span className="count-badge">{saved.length}</span>}
            </button>
            <button className="icon-button cart-header" type="button" aria-label={`Open basket, ${cartCount} items`} onClick={() => setCartOpen(true)}>
              <Icon name="cart" size={21} /><span className="count-badge">{cartCount}</span>
            </button>
            <button className="menu-toggle" type="button" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><Icon name={mobileMenuOpen ? 'close' : 'menu'} size={22} /></button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="shop">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-line" /> YOUR NEIGHBOURHOOD PHARMACY</span>
            <h1>A brighter way<br />to <span>feel your best.</span></h1>
            <p>Everyday essentials, thoughtful advice, and a little extra care — all in one happy place.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#products">Shop wellness <Icon name="arrow" size={17} /></a>
              <a className="button button-text" href="#care">Get to know us <Icon name="chevron" size={16} /></a>
            </div>
            <div className="hero-reassurance"><div className="mini-avatars"><span>V</span><span>+</span><span>♡</span></div><span>Care you can count on, every day.</span></div>
          </div>
          <div className="hero-art">
            <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
            <div className="hero-sun" />
            <span className="hero-star star-one">✳</span><span className="hero-star star-two">✦</span><span className="hero-star star-three">✧</span>
            <div className="hero-logo-card"><img src={logo} alt="Vitalight Pharmacy — your health, our priority" /></div>
            <div className="hero-float-card float-card-top"><span className="float-icon"><Icon name="shield" size={19} /></span><span><strong>Trusted care</strong><small>Here for your wellbeing</small></span></div>
            <div className="hero-float-card float-card-bottom"><span className="float-icon pink"><Icon name="truck" size={19} /></span><span><strong>At your doorstep</strong><small>Convenience with care</small></span></div>
            <span className="hero-caption">A healthier little everyday <i>✿</i></span>
          </div>
          <div className="hero-bottom"><span>YOUR HEALTH <b>♥</b> OUR PRIORITY</span><span>CARE THAT FEELS LIKE YOU <i>✳</i></span></div>
        </section>

        <section className="benefit-strip" aria-label="Vitalight benefits">
          <div className="benefit-item"><span className="benefit-icon"><Icon name="shield" size={21} /></span><span><strong>Trusted products</strong><small>Quality you can feel good about</small></span></div>
          <div className="benefit-item"><span className="benefit-icon pink-icon"><Icon name="headset" size={21} /></span><span><strong>A caring team</strong><small>Real people, here to help</small></span></div>
          <div className="benefit-item"><span className="benefit-icon"><Icon name="truck" size={21} /></span><span><strong>Easy ordering</strong><small>Wellness made more convenient</small></span></div>
        </section>

        <section className="categories-section section-wrap" id="categories">
          <div className="section-heading">
            <div><span className="eyebrow"><span className="eyebrow-line" /> FIND YOUR FEEL-GOOD</span><h2>A little something for <em>every you.</em></h2></div>
            <button className="text-link" type="button" onClick={() => chooseCategory('All')}>Browse everything <Icon name="arrow" size={17} /></button>
          </div>
          <div className="category-grid">
            {categories.map((category, index) => (
              <button className={`category-card category-${index + 1}`} key={category.name} type="button" onClick={() => chooseCategory(category.name)}>
                <span className="category-symbol">{category.icon}</span>
                <span className="category-copy"><strong>{category.name}</strong><small>{category.description}</small></span>
                <span className="category-arrow"><Icon name="arrow" size={16} /></span>
              </button>
            ))}
          </div>
        </section>

        <section className="products-section section-wrap" id="products">
          <div className="section-heading product-heading">
            <div><span className="eyebrow"><span className="eyebrow-line" /> LITTLE THINGS, BIG DIFFERENCE</span><h2>Good picks for <em>good days.</em></h2></div>
            <div className="product-tabs" aria-label="Filter products">
              {['All', 'Vitamins & supplements', 'Personal care'].map((category) => <button className={activeCategory === category ? 'active' : ''} key={category} type="button" onClick={() => setActiveCategory(category)}>{category === 'Vitamins & supplements' ? 'Vitamins' : category === 'Personal care' ? 'Personal care' : 'For you'}</button>)}
            </div>
          </div>
          <div className="product-grid">
            {visibleProducts.length ? visibleProducts.map((product) => <ProductCard key={product.id} product={product} isSaved={saved.includes(product.id)} onAdd={addToCart} onSave={toggleSaved} />) : (
              <div className="empty-products"><span>✿</span><h3>No products found just yet</h3><p>Try another search or browse all our feel-good essentials.</p><button className="button button-primary" type="button" onClick={() => { setQuery(''); setActiveCategory('All') }}>See all products</button></div>
            )}
          </div>
          <p className="catalogue-note">A curated selection to help you get started. Ask our team about product availability and advice.</p>
        </section>

        <section className="care-banner section-wrap" id="care">
          <div className="care-pattern" aria-hidden="true"><span>✳</span><span>♡</span><span>✦</span></div>
          <div className="care-copy"><span className="eyebrow"><span className="eyebrow-line" /> A PHARMACY WITH HEART</span><h2>Good health is<br />personal. <em>So is our care.</em></h2><p>Not sure what you need? Our friendly pharmacy team is happy to help you find the right next step.</p><button className="button button-light" type="button" onClick={() => { document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' }); showNotice('Reach our team using the contact details below.') }}>We’re here for you <Icon name="arrow" size={17} /></button></div>
          <div className="care-note"><span className="care-heart">♥</span><p>Here for your health.<br /><strong>Here for you.</strong></p><small>VITALIGHT PHARMACY</small></div>
        </section>

        <section className="newsletter section-wrap">
          <span className="newsletter-mark">✿</span>
          <div><span className="eyebrow"><span className="eyebrow-line" /> A NOTE FROM US</span><h2>Care tips, coming your way.</h2><p>Questions about an order? Our team is just a call away.</p></div>
          <a className="button button-primary" href="tel:+234">Talk to our team <Icon name="arrow" size={17} /></a>
        </section>
      </main>

      <footer className="site-footer" id="footer">
        <div className="footer-main">
          <div className="footer-brand"><a className="brand footer-logo" href="#"><img src={logo} alt="" /><span className="brand-name">VITALIGHT<span>PHARMACY</span></span></a><p>Your health, our priority.<br />A little more care in every day.</p></div>
          <div className="footer-column"><h3>Explore</h3><a href="#shop">Shop all</a><a href="#categories">Browse categories</a><a href="#care">Our promise</a><a href="/admin">Admin sign in</a></div>
          <div className="footer-column"><h3>We’re here to help</h3><a href="tel:+234">Call the pharmacy</a><a href="mailto:hello@vitalightpharmacy.com">Send us an email</a><a href="#products">Product questions</a></div>
          <div className="footer-contact"><span className="contact-icon"><Icon name="headset" size={20} /></span><div><strong>A real person, a real answer.</strong><p>Get in touch with our friendly team for help with your order or products.</p><a href="mailto:hello@vitalightpharmacy.com">hello@vitalightpharmacy.com <Icon name="arrow" size={14} /></a></div></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Vitalight Pharmacy. Made with care.</span><span>Always follow the advice of your healthcare professional.</span><span>White <i /> Navy <i className="pink-dot" /> Fuchsia</span></div>
      </footer>

      {cartOpen && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}>
        <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <div className="drawer-heading"><div><span className="eyebrow">YOUR LITTLE BASKET</span><h2 id="cart-title">Your basket <span>({cartCount})</span></h2></div><button className="icon-button close-button" type="button" aria-label="Close basket" onClick={() => setCartOpen(false)}><Icon name="close" /></button></div>
          {cartProducts.length ? <>
            <div className="cart-items">{cartProducts.map((product) => <div className="cart-item" key={product.id}><ProductArtwork type={product.art} color={product.color} /><div className="cart-item-copy"><strong>{product.name}</strong><small>{formatPrice(product.price)}</small><div className="quantity-control"><button type="button" aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product.id, -1)}><Icon name="minus" size={14} /></button><span>{cart[product.id]}</span><button type="button" aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(product.id, 1)}><Icon name="plus" size={14} /></button></div></div><strong className="cart-line-total">{formatPrice(product.price * cart[product.id])}</strong></div>)}</div>
            <div className="cart-summary"><div><span>Estimated total</span><strong>{formatPrice(cartTotal)}</strong></div><p>Our team will confirm availability and final pricing before your order is fulfilled.</p><button className="button button-primary checkout-button" type="button" onClick={startOrder}>Request this order <Icon name="arrow" size={17} /></button><button className="continue-button" type="button" onClick={() => setCartOpen(false)}>Keep browsing</button></div>
          </> : <div className="empty-cart"><span className="empty-cart-icon"><Icon name="cart" size={28} /></span><h3>Your basket is taking a little break.</h3><p>Add something lovely for your health and wellness.</p><button className="button button-primary" type="button" onClick={() => { setCartOpen(false); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }}>Explore products <Icon name="arrow" size={17} /></button></div>}
        </aside>
      </div>}

      {orderOpen && <div className="overlay order-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOrderOpen(false) }}>
        <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="order-title">
          <div className="drawer-heading"><div><span className="eyebrow">JUST A FEW DETAILS</span><h2 id="order-title">Request your order</h2></div><button className="icon-button close-button" type="button" aria-label="Close order form" onClick={() => setOrderOpen(false)}><Icon name="close" /></button></div>
          <p className="order-intro">Share your details and our team will be in touch to confirm availability, delivery, and pricing.</p>
          <form className="order-form" onSubmit={submitOrder}>
            <label>Your name<input autoComplete="name" required minLength="2" maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Ada Okafor" /></label>
            <label>Phone number<input autoComplete="tel" required type="tel" pattern={'[+0-9\\(\\)\\- ]{7,25}'} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+234 800 000 0000" /></label>
            <label>Delivery address<textarea autoComplete="street-address" required minLength="5" maxLength="500" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Where should we deliver?" rows="3" /></label>
            <div className="order-total"><span>{cartCount} {cartCount === 1 ? 'item' : 'items'} · estimated total</span><strong>{formatPrice(cartTotal)}</strong></div>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <button className="button button-primary checkout-button" type="submit" disabled={submitting}>{submitting ? 'Sending your request…' : 'Send order request'} {!submitting && <Icon name="arrow" size={17} />}</button>
            <p className="form-disclaimer">This is an order request, not a payment. We’ll contact you to confirm your order.</p>
          </form>
        </section>
      </div>}

      {notice && <div className="toast" role="status"><span><Icon name="check" size={16} /></span>{notice}</div>}
    </>
  )
}

export default App
