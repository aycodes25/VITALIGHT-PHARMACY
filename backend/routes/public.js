import { Router } from 'express'
import { isMissingColumn } from '../lib/dbErrors.js'
import { customerFromRequest } from '../lib/customer.js'

const LEGACY_PRODUCT_COLUMNS = 'id, name, category, detail, price, old_price, tag, art, color, image_url, stock, is_active, featured'
const NO_IMAGES_PRODUCT_COLUMNS = `${LEGACY_PRODUCT_COLUMNS}, brand, rx_required, sort_order`
const CATALOG_PRODUCT_COLUMNS = `${NO_IMAGES_PRODUCT_COLUMNS}, images`
const CAPABILITY_TTL_MS = 60 * 1000

// Fallback steps, richest first, used while newer migrations are missing.
const LEVELS = [
  { name: 'full', columns: CATALOG_PRODUCT_COLUMNS, sortOrder: true },
  { name: 'noImages', columns: NO_IMAGES_PRODUCT_COLUMNS, sortOrder: true },
  { name: 'legacy', columns: LEGACY_PRODUCT_COLUMNS, sortOrder: false },
]

export function publicRoutes({ supabase, starter, now = Date.now }) {
  const router = Router()
  // Discovered capability, cached for a minute so a missing migration costs one probe, not 2-3 queries per request.
  let capability = { level: 0, at: 0 }

  router.get('/catalog', async (_req, res) => {
    if (!supabase) return res.json({ products: starter.products, categories: starter.categories })
    try {
      const loadProducts = ({ columns, sortOrder }) => {
        let query = supabase.from('products').select(columns).eq('is_active', true).order('featured', { ascending: false })
        if (sortOrder) query = query.order('sort_order', { ascending: true })
        return query.order('name', { ascending: true })
      }
      const categoriesPromise = supabase.from('categories')
        .select('name, description, icon, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      let level = now() - capability.at < CAPABILITY_TTL_MS ? capability.level : 0
      let productsResult = await loadProducts(LEVELS[level])
      while (productsResult.error && isMissingColumn(productsResult.error) && level < LEVELS.length - 1) {
        level += 1
        console.warn(`Catalogue columns are missing; apply the pending Supabase migrations. Serving the "${LEVELS[level].name}" column set.`)
        productsResult = await loadProducts(LEVELS[level])
      }
      if (!productsResult.error) capability = { level, at: now() }
      const { data: categories, error: categoriesError } = await categoriesPromise
      if (productsResult.error) throw productsResult.error
      if (categoriesError) throw categoriesError
      const products = productsResult.data
      return res.json({
        products: products.map((product) => ({
          brand: '',
          rx_required: false,
          sort_order: 0,
          ...product,
          images: Array.isArray(product.images) && product.images.length ? product.images : (product.image_url ? [product.image_url] : []),
          oldPrice: product.old_price,
        })),
        categories,
      })
    } catch (error) {
      console.error('Unable to load the live storefront catalogue:', error.message)
      return res.status(503).json({ error: 'The live catalogue could not be loaded. Please try again shortly.' })
    }
  })

  router.post('/orders', async (req, res) => {
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
        !item
        || typeof item.productId !== 'string'
        || !/^[a-z0-9-]{1,60}$/.test(item.productId)
        || !Number.isInteger(item.quantity)
        || item.quantity < 1
        || item.quantity > 99
      ) {
        return res.status(400).json({ error: 'One or more products in your order are invalid.' })
      }
    }
    if (new Set(items.map((item) => item.productId)).size !== items.length) {
      return res.status(400).json({ error: 'Please list each product once and adjust the quantity instead.' })
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Order requests are not available yet. Please contact the pharmacy directly.' })
    }

    const customer = await customerFromRequest(supabase, req)
    if (!customer) {
      return res.status(401).json({ error: 'Sign in or create an account to request an order.' })
    }

    try {
      const { data: activeProducts, error: productError } = await supabase
        .from('products')
        .select('id, name, price, stock')
        .in('id', items.map((item) => item.productId))
        .eq('is_active', true)
      if (productError) throw productError
      const available = new Map(activeProducts.map((product) => [product.id, product]))
      if (items.some((item) => !available.has(item.productId))) {
        return res.status(400).json({ error: 'One or more products are no longer available. Refresh the catalogue and try again.' })
      }
      if (items.some((item) => available.get(item.productId).stock < item.quantity)) {
        return res.status(409).json({ error: 'One or more products do not have enough stock. Refresh the catalogue and try again.' })
      }

      const orderItems = items.map((item) => {
        const product = available.get(item.productId)
        return { productId: item.productId, name: product.name, price: product.price, quantity: item.quantity }
      })
      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: customer.id,
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

  return router
}
