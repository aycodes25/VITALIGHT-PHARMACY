import { Router } from 'express'

const CATALOG_PRODUCT_COLUMNS = 'id, name, category, detail, price, old_price, tag, art, color, image_url, stock, is_active, featured, brand, rx_required, sort_order'

export function publicRoutes({ supabase, starter }) {
  const router = Router()

  router.get('/catalog', async (_req, res) => {
    if (!supabase) return res.json({ products: starter.products, categories: starter.categories })
    try {
      const [{ data: products, error: productsError }, { data: categories, error: categoriesError }] = await Promise.all([
        supabase.from('products')
          .select(CATALOG_PRODUCT_COLUMNS)
          .eq('is_active', true)
          .order('featured', { ascending: false })
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        supabase.from('categories')
          .select('name, description, icon, sort_order')
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

    if (!supabase) {
      return res.status(503).json({ error: 'Order requests are not available yet. Please contact the pharmacy directly.' })
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
