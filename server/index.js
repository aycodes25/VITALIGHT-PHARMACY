import 'dotenv/config'
import express from 'express'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { categories as starterCategories, products as starterProducts } from '../src/catalog.js'

const app = express()
const port = Number(process.env.PORT) || 3001
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const configuredAdmins = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
)
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDistPath = path.resolve(__dirname, '..', 'dist')
const allowedArt = new Set(['vitamin', 'vitaminc', 'cleanser', 'firstaid', 'omega', 'device', 'medicine'])
const allowedColors = new Set(['lavender', 'peach', 'mint', 'blue'])
const allowedStatuses = new Set(['new', 'contacted', 'fulfilled', 'cancelled'])

app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

function requireDatabase(_req, res, next) {
  if (!supabase) {
    return res.status(503).json({ error: 'The admin API is not configured. Add Supabase server credentials to the server environment.' })
  }
  return next()
}

async function requireAdmin(req, res, next) {
  if (!supabase) {
    return res.status(503).json({ error: 'The admin API is not configured. Add Supabase server credentials to the server environment.' })
  }
  if (configuredAdmins.size === 0) {
    return res.status(503).json({ error: 'Admin access is not configured. Add an approved email to ADMIN_EMAILS.' })
  }

  const authorization = req.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) {
    return res.status(401).json({ error: 'Sign in with an approved admin account to continue.' })
  }

  try {
    const { data, error } = await supabase.auth.getUser(token)
    const user = data?.user
    if (error || !user || !user.email) {
      return res.status(401).json({ error: 'Your admin session is invalid or expired. Sign in again.' })
    }
    if (!user.email_confirmed_at || !configuredAdmins.has(user.email.toLowerCase())) {
      return res.status(403).json({ error: 'This account is not authorised to manage the pharmacy.' })
    }
    req.admin = { id: user.id, email: user.email }
    return next()
  } catch (error) {
    console.error('Unable to verify admin session:', error.message)
    return res.status(503).json({ error: 'Admin sign-in could not be verified. Please try again shortly.' })
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    supabaseConfigured: Boolean(supabase),
    adminConfigured: Boolean(supabase && configuredAdmins.size),
  })
})

app.get('/api/catalog', async (_req, res) => {
  if (!supabase) {
    return res.json({ products: starterProducts, categories: starterCategories })
  }
  try {
    const [{ data: products, error: productsError }, { data: categories, error: categoriesError }] = await Promise.all([
      supabase.from('products')
        .select('id, name, category, detail, price, old_price, tag, art, color, image_url, stock, is_active, featured')
        .eq('is_active', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('categories')
        .select('name, description, icon')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ])
    if (productsError) throw productsError
    if (categoriesError) throw categoriesError
    return res.json({
      products: products.map((product) => ({ ...product, oldPrice: product.old_price })),
      categories,
    })
  } catch (error) {
    console.error('Unable to load the live storefront catalogue:', error.message)
    return res.status(503).json({ error: 'The live catalogue could not be loaded. Please try again shortly.' })
  }
})

app.post('/api/orders', async (req, res) => {
  const { name, phone, address, items } = req.body ?? {}
  const customerName = typeof name === 'string' ? name.trim() : ''
  const customerPhone = typeof phone === 'string' ? phone.trim() : ''
  const deliveryAddress = typeof address === 'string' ? address.trim() : ''

  if (customerName.length < 2 || customerName.length > 100) {
    return res.status(400).json({ error: 'Enter a name between 2 and 100 characters.' })
  }
  if (!/^[+\d\s()-]{7,25}$/.test(customerPhone)) {
    return res.status(400).json({ error: 'Enter a valid phone number.' })
  }
  if (deliveryAddress.length < 5 || deliveryAddress.length > 500) {
    return res.status(400).json({ error: 'Enter a delivery address between 5 and 500 characters.' })
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    return res.status(400).json({ error: 'Your order must contain between 1 and 20 products.' })
  }
  for (const item of items) {
    if (
      !item ||
      typeof item.productId !== 'string' ||
      !/^[a-z0-9-]{1,60}$/.test(item.productId) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      return res.status(400).json({ error: 'One or more products in your order are invalid.' })
    }
  }

  if (!supabase) {
    return res.status(503).json({ error: 'Order requests are not available yet. Please contact the pharmacy directly.' })
  }

  try {
    const { data: activeProducts, error: productError } = await supabase
      .from('products')
      .select('id, stock')
      .in('id', items.map((item) => item.productId))
      .eq('is_active', true)
    if (productError) throw productError
    const availableProducts = new Map(activeProducts.map((product) => [product.id, product]))
    if (items.some((item) => !availableProducts.has(item.productId))) {
      return res.status(400).json({ error: 'One or more products are no longer available. Refresh the catalogue and try again.' })
    }
    if (items.some((item) => availableProducts.get(item.productId).stock < item.quantity)) {
      return res.status(409).json({ error: 'One or more products do not have enough stock. Refresh the catalogue and try again.' })
    }

    const orderItems = items.map((item) => {
      const product = availableProducts.get(item.productId)
      return { productId: item.productId, name: product.name, price: product.price, quantity: item.quantity }
    })
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name: customerName,
        phone: customerPhone,
        delivery_address: deliveryAddress,
        items: orderItems,
        status: 'new',
      })
      .select('id')
      .single()
    if (error) throw error
    return res.status(201).json({ orderId: data.id, message: 'Your order request was received.' })
  } catch (error) {
    console.error('Unable to save pharmacy order:', error.message)
    return res.status(500).json({ error: 'We could not submit your request. Please try again shortly.' })
  }
})

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ user: req.admin })
})

app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  try {
    const [{ data: products, error: productsError }, { data: orders, error: ordersError }, { data: categories, error: categoriesError }] = await Promise.all([
      supabase.from('products').select('id, is_active, stock'),
      supabase.from('orders').select('id, status, created_at'),
      supabase.from('categories').select('name'),
    ])
    if (productsError) throw productsError
    if (ordersError) throw ordersError
    if (categoriesError) throw categoriesError
    return res.json({
      products: products.length,
      activeProducts: products.filter((product) => product.is_active).length,
      lowStock: products.filter((product) => product.is_active && product.stock <= 5).length,
      orders: orders.length,
      newOrders: orders.filter((order) => order.status === 'new').length,
      categories: categories.length,
      recentOrders: orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    })
  } catch (error) {
    console.error('Unable to load pharmacy admin overview:', error.message)
    return res.status(500).json({ error: 'The dashboard summary could not be loaded.' })
  }
})

app.get('/api/admin/products', requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabase.from('products')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return res.json({ products: data })
  } catch (error) {
    console.error('Unable to list pharmacy products:', error.message)
    return res.status(500).json({ error: 'Products could not be loaded.' })
  }
})

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const { id, name, category, detail, price, old_price, tag, art, color, image_url, stock, is_active, featured } = req.body ?? {}
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 60) {
    return res.status(400).json({ error: 'Use a unique product ID made from lowercase letters, numbers, and hyphens.' })
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) {
    return res.status(400).json({ error: 'Product names must contain 2 to 120 characters.' })
  }
  if (typeof category !== 'string' || category.trim().length < 2 || category.trim().length > 80) {
    return res.status(400).json({ error: 'Choose a valid product category.' })
  }
  if (typeof detail !== 'string' || detail.trim().length > 240 || !Number.isInteger(price) || price < 0 || price > 100000000) {
    return res.status(400).json({ error: 'Enter a description up to 240 characters and a valid whole-number price.' })
  }
  if (old_price !== null && old_price !== undefined && (!Number.isInteger(old_price) || old_price < 0 || old_price > 100000000)) {
    return res.status(400).json({ error: 'The original price must be a valid whole number or left empty.' })
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
    return res.status(400).json({ error: 'Stock must be a whole number between 0 and 1,000,000.' })
  }
  if (typeof tag !== 'string' || tag.trim().length > 30 || !allowedArt.has(art) || !allowedColors.has(color)) {
    return res.status(400).json({ error: 'Choose a valid product badge, illustration, and background colour.' })
  }
  if (typeof is_active !== 'boolean' || typeof featured !== 'boolean') {
    return res.status(400).json({ error: 'Choose whether this product is active and featured.' })
  }
  if (image_url !== null && image_url !== undefined && (typeof image_url !== 'string' || !image_url.startsWith(`${supabaseUrl}/storage/v1/object/public/product-images/`))) {
    return res.status(400).json({ error: 'Product images must be uploaded to the pharmacy image library.' })
  }

  try {
    const product = {
      id,
      name: name.trim(),
      category: category.trim(),
      detail: detail.trim(),
      price,
      old_price: old_price ?? null,
      tag: tag.trim(),
      art,
      color,
      image_url: image_url || null,
      stock,
      is_active,
      featured,
    }
    const { data, error } = await supabase.from('products').insert(product).select('*').single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That product ID is already in use.' })
      if (error.code === '23503') return res.status(400).json({ error: 'Create the selected category before adding this product.' })
      throw error
    }
    return res.status(201).json({ product: data })
  } catch (error) {
    console.error('Unable to create pharmacy product:', error.message)
    return res.status(500).json({ error: 'The product could not be saved.' })
  }
})

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const { name, category, detail, price, old_price, tag, art, color, image_url, stock, is_active, featured } = req.body ?? {}
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) {
    return res.status(400).json({ error: 'Product names must contain 2 to 120 characters.' })
  }
  if (typeof category !== 'string' || category.trim().length < 2 || category.trim().length > 80) {
    return res.status(400).json({ error: 'Choose a valid product category.' })
  }
  if (typeof detail !== 'string' || detail.trim().length > 240 || !Number.isInteger(price) || price < 0 || price > 100000000) {
    return res.status(400).json({ error: 'Enter a description up to 240 characters and a valid whole-number price.' })
  }
  if (old_price !== null && old_price !== undefined && (!Number.isInteger(old_price) || old_price < 0 || old_price > 100000000)) {
    return res.status(400).json({ error: 'The original price must be a valid whole number or left empty.' })
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
    return res.status(400).json({ error: 'Stock must be a whole number between 0 and 1,000,000.' })
  }
  if (typeof tag !== 'string' || tag.trim().length > 30 || !allowedArt.has(art) || !allowedColors.has(color)) {
    return res.status(400).json({ error: 'Choose a valid product badge, illustration, and background colour.' })
  }
  if (typeof is_active !== 'boolean' || typeof featured !== 'boolean') {
    return res.status(400).json({ error: 'Choose whether this product is active and featured.' })
  }
  if (image_url !== null && image_url !== undefined && (typeof image_url !== 'string' || !image_url.startsWith(`${supabaseUrl}/storage/v1/object/public/product-images/`))) {
    return res.status(400).json({ error: 'Product images must be uploaded to the pharmacy image library.' })
  }

  try {
    const { data, error } = await supabase.from('products')
      .update({
        name: name.trim(),
        category: category.trim(),
        detail: detail.trim(),
        price,
        old_price: old_price ?? null,
        tag: tag.trim(),
        art,
        color,
        image_url: image_url || null,
        stock,
        is_active,
        featured,
      })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle()
    if (error) {
      if (error.code === '23503') return res.status(400).json({ error: 'Create the selected category before moving this product.' })
      throw error
    }
    if (!data) return res.status(404).json({ error: 'This product no longer exists.' })
    return res.json({ product: data })
  } catch (error) {
    console.error('Unable to update pharmacy product:', error.message)
    return res.status(500).json({ error: 'The product could not be updated.' })
  }
})

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('products')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'This product no longer exists.' })
    return res.json({ archived: true })
  } catch (error) {
    console.error('Unable to delete pharmacy product:', error.message)
    return res.status(500).json({ error: 'The product could not be deleted. Remove any order references first.' })
  }
})

app.post('/api/admin/products/:id/image', requireAdmin, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), async (req, res) => {
  const mimeTypes = {
    'image/jpeg': { extension: 'jpg', signature: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
    'image/png': { extension: 'png', signature: (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    'image/webp': { extension: 'webp', signature: (bytes) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' },
  }
  const contentType = req.get('content-type') || ''
  const imageType = mimeTypes[contentType]
  if (!Buffer.isBuffer(req.body) || req.body.length === 0 || !imageType || !imageType.signature(req.body)) {
    return res.status(400).json({ error: 'Choose a valid JPEG, PNG, or WebP image (maximum 5 MB).' })
  }
  try {
    const { data: product, error: productError } = await supabase.from('products')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle()
    if (productError) throw productError
    if (!product) return res.status(404).json({ error: 'Save the product before uploading its image.' })

    const objectPath = `${product.id}/${randomUUID()}.${imageType.extension}`
    const { error: uploadError } = await supabase.storage.from('product-images')
      .upload(objectPath, req.body, { contentType, upsert: false })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('product-images').getPublicUrl(objectPath)
    return res.status(201).json({ imageUrl: data.publicUrl })
  } catch (error) {
    console.error('Unable to upload pharmacy product image:', error.message)
    return res.status(500).json({ error: 'The product image could not be uploaded. Check the product-images storage bucket.' })
  }
})

app.get('/api/admin/categories', requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabase.from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw error
    return res.json({ categories: data })
  } catch (error) {
    console.error('Unable to list pharmacy categories:', error.message)
    return res.status(500).json({ error: 'Categories could not be loaded.' })
  }
})

app.post('/api/admin/categories', requireAdmin, async (req, res) => {
  const { name, description, icon, sort_order, is_active } = req.body ?? {}
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return res.status(400).json({ error: 'Category names must contain 2 to 80 characters.' })
  }
  if (typeof description !== 'string' || description.trim().length > 160 || typeof icon !== 'string' || icon.length > 8) {
    return res.status(400).json({ error: 'Enter a description up to 160 characters and a short category icon.' })
  }
  if (!Number.isInteger(sort_order) || sort_order < 0 || sort_order > 999 || typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'Enter a valid display order and choose whether the category is active.' })
  }
  try {
    const { data, error } = await supabase.from('categories')
      .insert({ name: name.trim(), description: description.trim(), icon, sort_order, is_active })
      .select('*')
      .single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That category already exists.' })
      throw error
    }
    return res.status(201).json({ category: data })
  } catch (error) {
    console.error('Unable to create pharmacy category:', error.message)
    return res.status(500).json({ error: 'The category could not be saved.' })
  }
})

app.put('/api/admin/categories/:name', requireAdmin, async (req, res) => {
  const { name, description, icon, sort_order, is_active } = req.body ?? {}
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return res.status(400).json({ error: 'Category names must contain 2 to 80 characters.' })
  }
  if (typeof description !== 'string' || description.trim().length > 160 || typeof icon !== 'string' || icon.length > 8) {
    return res.status(400).json({ error: 'Enter a description up to 160 characters and a short category icon.' })
  }
  if (!Number.isInteger(sort_order) || sort_order < 0 || sort_order > 999 || typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'Enter a valid display order and choose whether the category is active.' })
  }
  try {
    const { data, error } = await supabase.from('categories')
      .update({ name: name.trim(), description: description.trim(), icon, sort_order, is_active })
      .eq('name', req.params.name)
      .select('*')
      .maybeSingle()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That category name is already in use.' })
      throw error
    }
    if (!data) return res.status(404).json({ error: 'This category no longer exists.' })
    return res.json({ category: data })
  } catch (error) {
    console.error('Unable to update pharmacy category:', error.message)
    return res.status(500).json({ error: 'The category could not be updated.' })
  }
})

app.delete('/api/admin/categories/:name', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories')
      .delete()
      .eq('name', req.params.name)
      .select('name')
      .maybeSingle()
    if (error) {
      if (error.code === '23503') return res.status(409).json({ error: 'Move or delete this category’s products before removing it.' })
      throw error
    }
    if (!data) return res.status(404).json({ error: 'This category no longer exists.' })
    return res.json({ deleted: true })
  } catch (error) {
    console.error('Unable to delete pharmacy category:', error.message)
    return res.status(500).json({ error: 'The category could not be deleted.' })
  }
})

app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabase.from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return res.json({ orders: data })
  } catch (error) {
    console.error('Unable to list pharmacy orders:', error.message)
    return res.status(500).json({ error: 'Orders could not be loaded.' })
  }
})

app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const { status } = req.body ?? {}
  if (typeof status !== 'string' || !allowedStatuses.has(status)) {
    return res.status(400).json({ error: 'Choose a valid order status.' })
  }
  try {
    const { data, error } = await supabase.from('orders')
      .update({ status })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'This order no longer exists.' })
    return res.json({ order: data })
  } catch (error) {
    console.error('Unable to update pharmacy order:', error.message)
    return res.status(500).json({ error: 'The order status could not be updated.' })
  }
})

app.use('/api/admin', requireDatabase)
app.use('/api/admin', (_req, res) => res.status(404).json({ error: 'Admin endpoint not found.' }))

app.use(express.static(clientDistPath))
app.get('*path', (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'), (error) => {
    if (error && !res.headersSent) {
      res.status(404).send('Build the storefront with npm run build before starting the production server.')
    }
  })
})

app.listen(port, () => {
  console.log(`Vitalight Pharmacy server listening on http://localhost:${port}`)
})
