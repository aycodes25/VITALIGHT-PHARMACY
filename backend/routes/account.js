import { Router } from 'express'
import { bearerToken, customerFromRequest } from '../lib/customer.js'

const PRODUCT_ID = /^[a-z0-9-]{1,60}$/

function cleanCart(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value).filter(
    ([id, quantity]) => PRODUCT_ID.test(id) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 99,
  )
  return Object.fromEntries(entries.slice(0, 100))
}

function cleanSaved(value) {
  if (!Array.isArray(value)) return null
  return [...new Set(value.filter((id) => typeof id === 'string' && PRODUCT_ID.test(id)))].slice(0, 200)
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : null
}

export function accountRoutes({ supabase }) {
  const router = Router()

  router.use(async (req, res, next) => {
    if (!supabase) return res.status(503).json({ error: 'Accounts are not available yet. Please try again later.' })
    if (!bearerToken(req)) return res.status(401).json({ error: 'Sign in to view your account.' })
    const customer = await customerFromRequest(supabase, req)
    if (!customer) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    req.customer = customer
    return next()
  })

  router.get('/profile', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('full_name, phone, address, cart, saved')
        .eq('user_id', req.customer.id)
        .maybeSingle()
      if (error) throw error
      return res.json({
        email: req.customer.email,
        name: data?.full_name ?? '',
        phone: data?.phone ?? '',
        address: data?.address ?? '',
        cart: data?.cart ?? {},
        saved: data?.saved ?? [],
      })
    } catch (error) {
      console.error('Unable to load customer profile:', error.message)
      return res.status(500).json({ error: 'We could not load your account. Please try again.' })
    }
  })

  router.put('/profile', async (req, res) => {
    const body = req.body ?? {}
    const row = { user_id: req.customer.id, updated_at: new Date().toISOString() }
    const fields = [['name', 'full_name', 100], ['phone', 'phone', 25], ['address', 'address', 500]]
    for (const [key, column, max] of fields) {
      if (body[key] === undefined) continue
      const text = cleanText(body[key], max)
      if (text === null) return res.status(400).json({ error: `Enter a valid ${key}.` })
      if (key === 'phone' && text && !/^[+\d\s()-]{7,25}$/.test(text)) {
        return res.status(400).json({ error: 'Enter a valid phone number.' })
      }
      row[column] = text
    }
    if (body.cart !== undefined) {
      const cart = cleanCart(body.cart)
      if (!cart) return res.status(400).json({ error: 'Invalid basket.' })
      row.cart = cart
    }
    if (body.saved !== undefined) {
      const saved = cleanSaved(body.saved)
      if (!saved) return res.status(400).json({ error: 'Invalid saved items.' })
      row.saved = saved
    }
    try {
      const { error } = await supabase.from('customer_profiles').upsert(row, { onConflict: 'user_id' })
      if (error) throw error
      return res.json({ ok: true })
    } catch (error) {
      console.error('Unable to save customer profile:', error.message)
      return res.status(500).json({ error: 'We could not save your changes. Please try again.' })
    }
  })

  router.get('/orders', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, items, delivery_address, created_at')
        .eq('user_id', req.customer.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return res.json({
        orders: data.map((order) => ({
          id: order.id,
          status: order.status,
          items: order.items,
          address: order.delivery_address,
          createdAt: order.created_at,
        })),
      })
    } catch (error) {
      console.error('Unable to load customer orders:', error.message)
      return res.status(500).json({ error: 'We could not load your orders. Please try again.' })
    }
  })

  return router
}
