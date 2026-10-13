import express, { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { validateProductInput } from '../lib/validate.js'
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '../lib/images.js'

const allowedStatuses = new Set(['new', 'contacted', 'fulfilled', 'cancelled'])

function validateCategoryInput(body = {}) {
  const { name, description, icon, sort_order, is_active } = body
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return { error: 'Category names must contain 2 to 80 characters.' }
  }
  if (typeof description !== 'string' || description.trim().length > 160 || typeof icon !== 'string' || icon.length > 8) {
    return { error: 'Enter a description up to 160 characters and a short category icon.' }
  }
  if (!Number.isInteger(sort_order) || sort_order < 0 || sort_order > 999 || typeof is_active !== 'boolean') {
    return { error: 'Enter a valid display order and choose whether the category is active.' }
  }
  return { value: { name: name.trim(), description: description.trim(), icon, sort_order, is_active } }
}

export function adminRoutes({ supabase, supabaseUrl, auth }) {
  const router = Router()
  // Applied per route (not router.use) so unknown /api/admin/* paths fall through
  // to the 404 handler without requiring authentication, as in the original server.
  const guard = auth.requireAdmin

  router.get('/me', guard, (req, res) => res.json({ user: req.admin }))

  router.get('/overview', guard, async (_req, res) => {
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

  router.get('/products', guard, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return res.json({ products: data })
    } catch (error) {
      console.error('Unable to list pharmacy products:', error.message)
      return res.status(500).json({ error: 'Products could not be loaded.' })
    }
  })

  router.post('/products', guard, async (req, res) => {
    const result = validateProductInput(req.body, { supabaseUrl, requireId: true })
    if (result.error) return res.status(400).json({ error: result.error })
    try {
      const { data, error } = await supabase.from('products').insert(result.value).select('*').single()
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

  router.put('/products/:id', guard, async (req, res) => {
    const result = validateProductInput(req.body, { supabaseUrl })
    if (result.error) return res.status(400).json({ error: result.error })
    try {
      const { data, error } = await supabase.from('products')
        .update(result.value)
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

  router.delete('/products/:id', guard, async (req, res) => {
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

  router.post('/products/:id/image', guard, express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_IMAGE_BYTES }), async (req, res) => {
    const contentType = req.get('content-type') || ''
    const imageType = IMAGE_TYPES[contentType]
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

  router.get('/categories', guard, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true })
      if (error) throw error
      return res.json({ categories: data })
    } catch (error) {
      console.error('Unable to list pharmacy categories:', error.message)
      return res.status(500).json({ error: 'Categories could not be loaded.' })
    }
  })

  router.post('/categories', guard, async (req, res) => {
    const result = validateCategoryInput(req.body)
    if (result.error) return res.status(400).json({ error: result.error })
    try {
      const { data, error } = await supabase.from('categories').insert(result.value).select('*').single()
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

  router.put('/categories/:name', guard, async (req, res) => {
    const result = validateCategoryInput(req.body)
    if (result.error) return res.status(400).json({ error: result.error })
    try {
      const { data, error } = await supabase.from('categories')
        .update(result.value)
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

  router.delete('/categories/:name', guard, async (req, res) => {
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

  router.get('/orders', guard, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return res.json({ orders: data })
    } catch (error) {
      console.error('Unable to list pharmacy orders:', error.message)
      return res.status(500).json({ error: 'Orders could not be loaded.' })
    }
  })

  router.patch('/orders/:id', guard, async (req, res) => {
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

  return router
}
