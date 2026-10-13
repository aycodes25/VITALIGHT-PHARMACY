import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import logo from '../../../shared/assets/logo.png'
import wordmark from '../../../shared/assets/vitalight logo.png'
import { productImages } from '../../../shared/productImages.js'
import { MAX_PHOTOS, moveToFirst, removeAt, validateNewFiles } from './imageList.js'
import { saveProductWithPhotos } from './saveProductWithPhotos.js'
import './admin.css'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const authClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
const navigation = [
  { id: 'overview', title: 'Overview', icon: '▦' },
  { id: 'products', title: 'Products', icon: '▧' },
  { id: 'categories', title: 'Categories', icon: '▤' },
  { id: 'orders', title: 'Orders', icon: '▣' },
]
const productDefaults = {
  id: '', name: '', category: '', detail: '', price: '', old_price: '', tag: '',
  art: 'vitamin', color: 'lavender', image_url: null, stock: 0, is_active: true, featured: false,
}
const categoryDefaults = { name: '', description: '', icon: '✳', sort_order: 0, is_active: true }

function money(amount) {
  return `₦${Number(amount || 0).toLocaleString('en-NG')}`
}

function dateTime(value) {
  return new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

async function getError(response) {
  try {
    const body = await response.json()
    return body.error || `Request failed with status ${response.status}.`
  } catch {
    return `Request failed with status ${response.status}.`
  }
}

function Admin() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [section, setSection] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [signIn, setSignIn] = useState({ email: '', password: '' })
  const [productDialog, setProductDialog] = useState(false)
  const [editingProductId, setEditingProductId] = useState(null)
  const [productForm, setProductForm] = useState(productDefaults)
  const [existingPhotos, setExistingPhotos] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [uploadProgress, setUploadProgress] = useState('')
  // Set once a product comes back without an images key: migration 003 is not applied.
  const [galleryMissing, setGalleryMissing] = useState(false)
  // Bumped whenever the product dialog opens or closes so late save results can be ignored.
  const dialogSession = useRef(0)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [editingCategoryName, setEditingCategoryName] = useState(null)
  const [categoryForm, setCategoryForm] = useState(categoryDefaults)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const authRequest = useCallback(async (path, options = {}) => {
    const { data, error: sessionError } = await authClient.auth.getSession()
    if (sessionError || !data.session) {
      setSession(null)
      throw new Error('Your admin session has expired. Sign in again.')
    }
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(options.body && !(options.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
    if (!response.ok) {
      const requestError = await getError(response)
      if (response.status === 401) {
        setSession(null)
        await authClient.auth.signOut()
      }
      throw new Error(requestError)
    }
    return response.json()
  }, [])

  const loadDashboard = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const [overviewResult, productsResult, categoriesResult, ordersResult] = await Promise.all([
        authRequest('/api/admin/overview'),
        authRequest('/api/admin/products'),
        authRequest('/api/admin/categories'),
        authRequest('/api/admin/orders'),
      ])
      setOverview(overviewResult)
      setProducts(productsResult.products)
      if (productsResult.products.length) setGalleryMissing(productsResult.products.some((item) => !('images' in item)))
      setCategories(categoriesResult.categories)
      setOrders(ordersResult.orders)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [authRequest, session])

  useEffect(() => {
    let active = true
    async function restoreSession() {
      if (!authClient) {
        setCheckingSession(false)
        return
      }
      try {
        const { data, error: sessionError } = await authClient.auth.getSession()
        if (sessionError) throw sessionError
        if (data.session) {
          const response = await fetch('/api/admin/me', {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          })
          if (!response.ok) {
            await authClient.auth.signOut()
            if (!response.status.toString().startsWith('4')) throw new Error(await getError(response))
          } else if (active) {
            setSession(data.session)
          }
        }
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setCheckingSession(false)
      }
    }
    restoreSession()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const visibleProducts = useMemo(() => {
    const needle = search.toLowerCase()
    return products.filter((product) => `${product.name} ${product.id} ${product.category}`.toLowerCase().includes(needle))
  }, [products, search])

  const visibleOrders = useMemo(() => {
    const needle = search.toLowerCase()
    return orders.filter((order) => `${order.customer_name} ${order.phone} ${order.id} ${order.status}`.toLowerCase().includes(needle))
  }, [orders, search])

  async function handleSignIn(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    if (!authClient) {
      setError('Admin sign-in needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.')
      setBusy(false)
      return
    }
    try {
      const { data, error: authError } = await authClient.auth.signInWithPassword(signIn)
      if (authError) throw authError
      const response = await fetch('/api/admin/me', {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })
      if (!response.ok) {
        const message = await getError(response)
        await authClient.auth.signOut()
        throw new Error(message)
      }
      setSignIn((current) => ({ ...current, password: '' }))
      setSession(data.session)
      setMessage('Welcome back.')
    } catch (signInError) {
      setError(signInError.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setError('')
    const { error: signOutError } = await authClient.auth.signOut()
    if (signOutError) setError(`Unable to sign out: ${signOutError.message}`)
    else {
      setSession(null)
      setOverview(null)
      setMessage('You have signed out.')
    }
  }

  function editProduct(product) {
    dialogSession.current += 1
    setEditingProductId(product.id)
    setProductForm({
      ...product,
      detail: product.detail || '',
      old_price: product.old_price ?? '',
      image_url: product.image_url || null,
    })
    setExistingPhotos(productImages(product))
    setNewFiles([])
    setUploadProgress('')
    setProductDialog(true)
    setError('')
  }

  function newProduct() {
    dialogSession.current += 1
    setEditingProductId(null)
    setProductForm({ ...productDefaults, category: categories[0]?.name || '' })
    setExistingPhotos([])
    setNewFiles([])
    setUploadProgress('')
    setProductDialog(true)
    setError('')
  }

  // The gallery is assumed available unless something proves migration 003 is missing.
  const galleryAvailable = !galleryMissing

  function closeProductDialog() {
    if (busy) return
    dialogSession.current += 1
    setProductDialog(false)
  }

  async function saveProduct(event) {
    event.preventDefault()
    const session_ = dialogSession.current
    const isStillCurrent = () => dialogSession.current === session_
    setBusy(true)
    setError('')
    try {
      const payload = {
        ...productForm,
        id: editingProductId || productForm.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: productForm.name.trim(),
        category: productForm.category,
        detail: productForm.detail.trim(),
        price: Number(productForm.price),
        old_price: productForm.old_price === '' ? null : Number(productForm.old_price),
        tag: productForm.tag.trim(),
        stock: Number(productForm.stock),
      }
      const productPath = (id) => `/api/admin/products/${encodeURIComponent(id)}`
      const result = await saveProductWithPhotos({
        payload,
        editingProductId,
        keptPhotos: existingPhotos,
        newFiles,
        galleryAvailable,
        createProduct: (body) => authRequest('/api/admin/products', { method: 'POST', body: JSON.stringify(body) }),
        updateProduct: (id, body) => authRequest(productPath(id), { method: 'PUT', body: JSON.stringify(body) }),
        uploadImage: async (id, file) => (await authRequest(`${productPath(id)}/image`, {
          method: 'POST',
          body: file,
          headers: { 'Content-Type': file.type },
        })).imageUrl,
        isStillCurrent,
        onProgress: (text) => { if (isStillCurrent()) setUploadProgress(text) },
      })
      if (result.aborted) {
        await loadDashboard()
        return
      }
      if (result.legacy) setGalleryMissing(true)
      setEditingProductId(result.productId)
      setProductForm({
        ...result.product,
        old_price: result.product.old_price ?? '',
        image_url: result.product.image_url || null,
      })
      setExistingPhotos(result.keptPhotos)
      // Only failed files stay queued; the product id above makes the retry an edit, not a second create.
      setNewFiles(result.failed.map((item) => item.file))
      setUploadProgress('')
      await loadDashboard()
      if (result.failed.length || result.error || result.rejected.length) {
        const parts = []
        if (result.failed.length) parts.push(`The product was saved, but ${result.failed.length} photo${result.failed.length === 1 ? '' : 's'} could not be uploaded: ${result.failed.map((item) => item.file.name).join(', ')}. Save again to retry.`)
        if (result.error) parts.push(`The uploaded photos could not be attached yet: ${result.error}. Save again to retry.`)
        if (result.rejected.length) parts.push(result.message)
        setError(parts.join(' '))
        return
      }
      if (isStillCurrent()) {
        dialogSession.current += 1
        setProductDialog(false)
      }
      setMessage(result.message)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setUploadProgress('')
      setBusy(false)
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Archive “${product.name}” and hide it from the storefront? Past order records will be kept.`)) return
    setBusy(true)
    setError('')
    try {
      await authRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' })
      setMessage('Product removed.')
      await loadDashboard()
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setBusy(false)
    }
  }

  function editCategory(category) {
    setEditingCategoryName(category.name)
    setCategoryForm({ ...category })
    setCategoryDialog(true)
    setError('')
  }

  async function saveCategory(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        ...categoryForm,
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        sort_order: Number(categoryForm.sort_order),
      }
      await authRequest(
        editingCategoryName ? `/api/admin/categories/${encodeURIComponent(editingCategoryName)}` : '/api/admin/categories',
        { method: editingCategoryName ? 'PUT' : 'POST', body: JSON.stringify(payload) },
      )
      setCategoryDialog(false)
      setMessage('Category saved.')
      await loadDashboard()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Remove the “${category.name}” category? Products in the category must be moved first.`)) return
    setBusy(true)
    setError('')
    try {
      await authRequest(`/api/admin/categories/${encodeURIComponent(category.name)}`, { method: 'DELETE' })
      setMessage('Category removed.')
      await loadDashboard()
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setBusy(false)
    }
  }

  async function changeOrderStatus(order, status) {
    setBusy(true)
    setError('')
    try {
      await authRequest(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setMessage(`Order marked ${status}.`)
      await loadDashboard()
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setBusy(false)
    }
  }

  if (checkingSession) {
    return <div className="admin-loading"><span className="admin-spinner" />Checking your secure admin session…</div>
  }

  if (!session) {
    return (
      <main className="admin-login-page">
        <a className="admin-back-link" href="/">← Back to Vitalight Pharmacy</a>
        <section className="admin-login-card">
          <div className="admin-login-brand"><img src={logo} alt="" /><img src={wordmark} alt="Vitalight Pharmacy" /></div>
          <span className="admin-login-kicker">VITALIGHT PHARMACY · ADMIN</span>
          <h1>Your pharmacy,<br /><em>in good hands.</em></h1>
          <p>Sign in with an approved admin account to manage your products, categories, and customer orders.</p>
          <form onSubmit={handleSignIn}>
            <label>Email address<input required type="email" autoComplete="username" value={signIn.email} onChange={(event) => setSignIn({ ...signIn, email: event.target.value })} placeholder="you@vitalightpharmacy.com" /></label>
            <label>Password<input required type="password" autoComplete="current-password" value={signIn.password} onChange={(event) => setSignIn({ ...signIn, password: event.target.value })} placeholder="Your password" /></label>
            {error && <p className="admin-alert" role="alert">{error}</p>}
            <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? 'Checking your details…' : 'Sign in to your dashboard'} <span>→</span></button>
          </form>
          <div className="admin-login-note">Private workspace · Only approved accounts can sign in</div>
        </section>
      </main>
    )
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand"><img src={logo} alt="" /><span><strong>VITALIGHT</strong><small>PHARMACY ADMIN</small></span></a>
        <div className="admin-store-label"><span /> STOREFRONT MANAGEMENT</div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navigation.map((item) => <button className={section === item.id ? 'selected' : ''} key={item.id} type="button" onClick={() => { setSection(item.id); setSearch(''); setError('') }}><span className="admin-nav-icon">{item.icon}</span>{item.title}{item.id === 'orders' && overview?.newOrders > 0 && <span className="admin-nav-badge">{overview.newOrders}</span>}</button>)}
        </nav>
        <div className="admin-sidebar-bottom"><span className="admin-avatar">{session.user.email?.[0]?.toUpperCase() || 'V'}</span><span className="admin-user-detail"><strong>{session.user.email}</strong><small>Administrator</small></span><button type="button" className="admin-signout-icon" title="Sign out" onClick={handleSignOut}>↗</button></div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div><a href="/" className="admin-mobile-brand">VITALIGHT</a><span className="admin-breadcrumb">Workspace <b>/</b> {navigation.find((item) => item.id === section)?.title}</span></div>
          <div className="admin-top-actions"><a href="/" target="_blank" rel="noreferrer">View storefront <span>↗</span></a><button type="button" onClick={loadDashboard} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button></div>
        </header>
        <section className="admin-content">
          <div className="admin-heading"><div><span className="admin-overline">YOUR PHARMACY, AT A GLANCE</span><h1>{section === 'overview' ? 'Good to see you.' : navigation.find((item) => item.id === section)?.title}</h1><p>{section === 'overview' ? 'Here’s what’s happening at Vitalight today.' : section === 'products' ? 'Add products, update prices, keep track of stock, and choose what shoppers see.' : section === 'categories' ? 'Organise the way customers explore your pharmacy.' : 'Review customer requests and keep every order moving.'}</p></div>
            {section === 'products' && <button className="admin-primary-button admin-heading-action" type="button" disabled={busy} onClick={newProduct}>＋ Add product</button>}
            {section === 'categories' && <button className="admin-primary-button admin-heading-action" type="button" onClick={() => { setEditingCategoryName(null); setCategoryForm({ ...categoryDefaults, sort_order: categories.length }); setCategoryDialog(true); setError('') }}>＋ Add category</button>}
          </div>
          {error && <div className="admin-alert admin-page-alert" role="alert"><span>!</span>{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
          {message && <div className="admin-success" role="status"><span>✓</span>{message}<button type="button" aria-label="Dismiss message" onClick={() => setMessage('')}>×</button></div>}
          {loading && !overview ? <div className="admin-loading"><span className="admin-spinner" />Loading your workspace…</div> : <>
            {section === 'overview' && <Overview overview={overview} orders={orders} setSection={setSection} />}
            {section === 'products' && <Products products={visibleProducts} search={search} setSearch={setSearch} editProduct={editProduct} deleteProduct={deleteProduct} busy={busy} />}
            {section === 'categories' && <Categories categories={categories} editCategory={editCategory} deleteCategory={deleteCategory} busy={busy} />}
            {section === 'orders' && <Orders orders={visibleOrders} products={products} search={search} setSearch={setSearch} changeOrderStatus={changeOrderStatus} busy={busy} />}
          </>}
        </section>
      </main>
      {productDialog && <ProductDialog
        categories={categories}
        product={productForm}
        editing={Boolean(editingProductId)}
        existingPhotos={existingPhotos}
        newFiles={newFiles}
        uploadProgress={uploadProgress}
        galleryAvailable={galleryAvailable}
        busy={busy}
        error={error}
        setError={setError}
        setProduct={setProductForm}
        setExistingPhotos={setExistingPhotos}
        setNewFiles={setNewFiles}
        onClose={closeProductDialog}
        onSubmit={saveProduct}
      />}
      {categoryDialog && <CategoryDialog category={categoryForm} editing={Boolean(editingCategoryName)} busy={busy} error={error} setCategory={setCategoryForm} onClose={() => setCategoryDialog(false)} onSubmit={saveCategory} />}
    </div>
  )
}

function Overview({ overview, orders, setSection }) {
  const cards = [
    { label: 'Products in catalogue', value: overview?.products ?? '—', icon: '▧', tone: 'blue' },
    { label: 'Active on storefront', value: overview?.activeProducts ?? '—', icon: '◉', tone: 'pink' },
    { label: 'New order requests', value: overview?.newOrders ?? '—', icon: '▣', tone: 'peach' },
    { label: 'Running low on stock', value: overview?.lowStock ?? '—', icon: '⌁', tone: 'gold' },
  ]
  return (
    <>
      <div className="admin-stat-grid">{cards.map((card) => <article className="admin-stat-card" key={card.label}><span className={`admin-stat-icon ${card.tone}`}>{card.icon}</span><span className="admin-stat-label">{card.label}</span><strong>{card.value}</strong><small>{card.tone === 'gold' && card.value > 0 ? 'Worth a closer look' : card.tone === 'peach' && card.value > 0 ? 'Waiting for your attention' : card.tone === 'pink' ? 'Visible to your customers' : 'Across your pharmacy'}</small></article>)}</div>
      <div className="admin-overview-panels">
        <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Recent orders</h2><p>Latest customer requests</p></div><button type="button" className="admin-link-button" onClick={() => setSection('orders')}>All orders →</button></div>
          {orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Order date</th><th>Status</th></tr></thead><tbody>{orders.slice(0, 5).map((order) => <tr key={order.id}><td><strong>{order.customer_name}</strong><small>{order.phone}</small></td><td>{dateTime(order.created_at)}</td><td><span className={`order-status status-${order.status}`}>{order.status}</span></td></tr>)}</tbody></table></div> : <div className="admin-empty-small">No orders have arrived yet.</div>}
        </section>
        <section className="admin-panel admin-quick-panel"><div className="admin-panel-heading"><div><h2>Quick actions</h2><p>A few things you can do next</p></div></div><button type="button" onClick={() => setSection('products')}><span className="quick-icon pink">＋</span><span><strong>Add a product</strong><small>Update your catalogue</small></span><span className="quick-arrow">→</span></button><button type="button" onClick={() => setSection('orders')}><span className="quick-icon blue">▣</span><span><strong>Check order requests</strong><small>{overview?.newOrders || 0} waiting for a response</small></span><span className="quick-arrow">→</span></button><button type="button" onClick={() => setSection('categories')}><span className="quick-icon gold">▤</span><span><strong>Organise categories</strong><small>Make browsing feel easy</small></span><span className="quick-arrow">→</span></button></section>
      </div>
    </>
  )
}

function Products({ products, search, setSearch, editProduct, deleteProduct, busy }) {
  return (
    <section className="admin-panel admin-data-panel">
      <div className="admin-panel-heading admin-list-heading"><div><h2>Your products <span className="admin-total">{products.length}</span></h2><p>Manage pricing, stock, and storefront visibility.</p></div><label className="admin-search">⌕<input aria-label="Search products" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" /></label></div>
      {products.length ?       <div className="admin-table-wrap"><table className="admin-table product-admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="admin-product-name">{product.image_url ? <img src={product.image_url} alt="" /> : <span className={`admin-product-placeholder ${product.color}`}>✳</span>}<span><strong>{product.name}</strong><small>{product.id}</small></span></div></td><td>{product.category}</td><td><strong>{money(product.price)}</strong>{product.old_price && <small className="admin-old-price">{money(product.old_price)}</small>}</td><td><span className={product.stock <= 5 ? 'stock-low' : ''}>{product.stock}</span>{product.stock <= 5 && <small className="stock-warning">Low stock</small>}</td><td><span className={`product-visibility ${product.is_active ? 'visible' : 'hidden'}`}><i />{product.is_active ? 'Active' : 'Hidden'}</span>{product.featured && <small className="featured-label">Featured</small>}</td><td><div className="row-actions"><button type="button" disabled={busy} onClick={() => editProduct(product)}>Edit</button>{product.is_active && <button type="button" disabled={busy} onClick={() => deleteProduct(product)}>Archive</button>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="No products match your search" text="Try another search, or add products to your catalogue." />}
    </section>
  )
}

function Categories({ categories, editCategory, deleteCategory, busy }) {
  return <section className="admin-panel admin-data-panel"><div className="admin-panel-heading"><div><h2>Shop categories <span className="admin-total">{categories.length}</span></h2><p>Active categories are displayed on the customer storefront.</p></div></div>{categories.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Category</th><th>Description</th><th>Order</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>{categories.map((category) => <tr key={category.name}><td><div className="admin-category-name"><span>{category.icon || '✳'}</span><strong>{category.name}</strong></div></td><td>{category.description || '—'}</td><td>{category.sort_order}</td><td><span className={`product-visibility ${category.is_active ? 'visible' : 'hidden'}`}><i />{category.is_active ? 'Active' : 'Hidden'}</span></td><td><div className="row-actions"><button type="button" onClick={() => editCategory(category)}>Edit</button><button type="button" disabled={busy} onClick={() => deleteCategory(category)}>Remove</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="Your category list is empty" text="Add a category before creating a new product." />}</section>
}

function Orders({ orders, products, search, setSearch, changeOrderStatus, busy }) {
  const productNames = new Map(products.map((product) => [product.id, product.name]))
  return <section className="admin-panel admin-data-panel"><div className="admin-panel-heading admin-list-heading"><div><h2>Customer orders <span className="admin-total">{orders.length}</span></h2><p>Order requests are not paid until you confirm directly with the customer.</p></div><label className="admin-search">⌕<input aria-label="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers…" /></label></div>{orders.length ? <div className="admin-table-wrap"><table className="admin-table order-admin-table"><thead><tr><th>Customer</th><th>Order</th><th>Delivery address</th><th>Received</th><th>Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.customer_name}</strong><a className="customer-phone" href={`tel:${order.phone}`}>{order.phone}</a></td><td><div className="order-item-summary">{(Array.isArray(order.items) ? order.items : []).map((item) => <span key={item.productId}>{item.quantity} × {item.name || productNames.get(item.productId) || item.productId}{Number.isInteger(item.price) ? ` · ${money(item.price)}` : ''}</span>)}</div><small className="order-total-label">Total: {money((Array.isArray(order.items) ? order.items : []).reduce((total, item) => total + (item.price || 0) * item.quantity, 0))}</small></td><td className="delivery-address">{order.delivery_address}</td><td>{dateTime(order.created_at)}</td><td><select className={`order-status-select status-${order.status}`} aria-label={`Status for order ${order.id}`} value={order.status} disabled={busy} onChange={(event) => changeOrderStatus(order, event.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></select></td></tr>)}</tbody></table></div> : <EmptyState title="No order requests yet" text="New customer requests will appear here." />}</section>
}

function EmptyState({ title, text }) {
  return <div className="admin-empty-state"><span>✳</span><h3>{title}</h3><p>{text}</p></div>
}

function NewPhotoPreview({ file }) {
  // Created inside the effect so StrictMode's mount/unmount/mount cycle revokes only URLs it also created.
  const [url, setUrl] = useState('')
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return url ? <img src={url} alt="" /> : <span className="photo-preview-pending" />
}

function PhotoPicker({ existingPhotos, newFiles, setExistingPhotos, setNewFiles, galleryAvailable, setError, disabled }) {
  const total = existingPhotos.length + newFiles.length
  function addFiles(event) {
    const picked = Array.from(event.target.files || [])
    event.target.value = ''
    if (!picked.length) return
    const result = validateNewFiles(total, picked)
    setError(result.errors.join(' '))
    if (result.accepted.length) setNewFiles([...newFiles, ...result.accepted])
  }
  return <div className="form-full image-upload-field photo-picker">
    <label>Product photos <small>Optional · up to {MAX_PHOTOS} · JPEG, PNG, or WebP · up to 5 MB each. The first photo is the main photo.</small>
      <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={disabled || total >= MAX_PHOTOS} onChange={addFiles} />
    </label>
    {!galleryAvailable && <small className="photo-note">Multiple photos need database migration 003; until then only the main photo is saved.</small>}
    {total > 0 && <ul className="photo-list">
      {existingPhotos.map((url, index) => <li key={url}>
        <img src={url} alt={`Product photo ${index + 1}`} />
        <span className="photo-label">{index === 0 ? 'Main photo' : `Photo ${index + 1}`}</span>
        <span className="photo-actions">
          {index > 0 && <button type="button" disabled={disabled} onClick={() => setExistingPhotos(moveToFirst(existingPhotos, index))}>Make main</button>}
          <button type="button" disabled={disabled} onClick={() => setExistingPhotos(removeAt(existingPhotos, index))}>Remove</button>
        </span>
      </li>)}
      {newFiles.map((file, index) => <li key={`${file.name}-${file.size}-${index}`} className="photo-new">
        <NewPhotoPreview file={file} />
        <span className="photo-label">{existingPhotos.length + index === 0 ? 'Main photo · ' : ''}{file.name} <em>(new)</em></span>
        <span className="photo-actions">
          <button type="button" disabled={disabled} onClick={() => setNewFiles(removeAt(newFiles, index))}>Remove</button>
        </span>
      </li>)}
    </ul>}
  </div>
}

function ProductDialog({ categories, product, editing, existingPhotos, newFiles, uploadProgress, galleryAvailable, busy, error, setError, setProduct, setExistingPhotos, setNewFiles, onClose, onSubmit }) {
  // Escape closes the dialog, except while a save is uploading photos.
  useEffect(() => {
    if (busy) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="admin-modal admin-product-modal" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title"><header><div><span className="admin-overline">{editing ? 'UPDATE YOUR CATALOGUE' : 'MAKE IT EASY TO FIND'}</span><h2 id="product-dialog-title">{editing ? 'Edit product' : 'Add a product'}</h2></div><button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></header><form onSubmit={onSubmit}><div className="admin-form-grid"><label className="form-full">Product name<input required minLength="2" maxLength="120" value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value, ...(!editing ? { id: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } : {}) })} placeholder="e.g. Daily Essentials Multivitamin" /></label>{!editing && <label className="form-full">Product ID <small>Created automatically from the product name.</small><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength="60" value={product.id} onChange={(event) => setProduct({ ...product, id: event.target.value })} /></label>}<label>Category<select required value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })}><option value="" disabled>Select a category</option>{categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}</select></label><label>Price (₦)<input required type="number" min="0" max="100000000" step="1" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} placeholder="8500" /></label><label>Previous price (₦)<input type="number" min="0" max="100000000" step="1" value={product.old_price ?? ''} onChange={(event) => setProduct({ ...product, old_price: event.target.value })} placeholder="Optional" /></label><label>Stock quantity<input required type="number" min="0" max="1000000" step="1" value={product.stock} onChange={(event) => setProduct({ ...product, stock: event.target.value })} /></label><label className="form-full">Short description<input maxLength="240" value={product.detail} onChange={(event) => setProduct({ ...product, detail: event.target.value })} placeholder="Size, pack details, or customer-friendly info" /></label><label>Product badge<input maxLength="30" value={product.tag} onChange={(event) => setProduct({ ...product, tag: event.target.value })} placeholder="BESTSELLER" /></label><label>Illustration<select value={product.art} onChange={(event) => setProduct({ ...product, art: event.target.value })}>{[['vitamin', 'Bottle'], ['vitaminc', 'Wide bottle'], ['cleanser', 'Cleanser'], ['firstaid', 'First aid kit'], ['omega', 'Supplement tub'], ['device', 'Health device'], ['medicine', 'Medicine']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Image background<select value={product.color} onChange={(event) => setProduct({ ...product, color: event.target.value })}>{[['lavender', 'Lavender'], ['peach', 'Peach'], ['mint', 'Mint'], ['blue', 'Blue']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><PhotoPicker existingPhotos={existingPhotos} newFiles={newFiles} setExistingPhotos={setExistingPhotos} setNewFiles={setNewFiles} galleryAvailable={galleryAvailable} setError={setError} disabled={busy} /><div className="form-toggles form-full"><label><input type="checkbox" checked={product.is_active} onChange={(event) => setProduct({ ...product, is_active: event.target.checked })} /><span>Visible on storefront</span></label><label><input type="checkbox" checked={product.featured} onChange={(event) => setProduct({ ...product, featured: event.target.checked })} /><span>Feature in the catalogue</span></label></div></div>{uploadProgress && <p className="modal-hint" role="status">{uploadProgress}</p>}{error && <p className="admin-alert modal-error" role="alert">{error}</p>}<footer><button className="admin-secondary-button" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="admin-primary-button" type="submit" disabled={busy || categories.length === 0}>{busy ? (uploadProgress || 'Saving…') : editing ? 'Save changes' : 'Add product'} <span>→</span></button></footer>{categories.length === 0 && <p className="modal-hint">Add a product category before creating products.</p>}</form></section></div>
}

function CategoryDialog({ category, editing, busy, error, setCategory, onClose, onSubmit }) {
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="admin-modal admin-category-modal" role="dialog" aria-modal="true" aria-labelledby="category-dialog-title"><header><div><span className="admin-overline">MAKE BROWSING FEEL EASY</span><h2 id="category-dialog-title">{editing ? 'Edit category' : 'Add a category'}</h2></div><button type="button" aria-label="Close dialog" onClick={onClose}>×</button></header><form onSubmit={onSubmit}><label>Category name<input required minLength="2" maxLength="80" value={category.name} onChange={(event) => setCategory({ ...category, name: event.target.value })} placeholder="e.g. Personal care" /></label><label>Description<input maxLength="160" value={category.description || ''} onChange={(event) => setCategory({ ...category, description: event.target.value })} placeholder="A short helpful description" /></label><div className="admin-form-grid"><label>Category icon<input maxLength="8" value={category.icon || ''} onChange={(event) => setCategory({ ...category, icon: event.target.value })} placeholder="✳" /></label><label>Display order<input required type="number" min="0" max="999" value={category.sort_order} onChange={(event) => setCategory({ ...category, sort_order: event.target.value })} /></label></div><label className="category-active-toggle"><input type="checkbox" checked={category.is_active} onChange={(event) => setCategory({ ...category, is_active: event.target.checked })} />Show this category on the storefront</label>{error && <p className="admin-alert modal-error" role="alert">{error}</p>}<footer><button className="admin-secondary-button" type="button" onClick={onClose}>Cancel</button><button className="admin-primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save category'} <span>→</span></button></footer></form></section></div>
}

export default Admin
