import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { adminRoutes } from '../routes/admin.js'
import { createAuth } from '../lib/auth.js'
import { parseAdminEmails } from '../lib/auth.js'
import { fakeSupabase } from './fakeSupabase.js'

const starter = {
  products: [{ id: 'demo', name: 'Demo', category: 'Medicines & pain relief', price: 100 }],
  categories: [{ name: 'Medicines & pain relief', icon: '✚', description: 'x' }],
}
const adminUser = { id: 'u1', email: 'owner@example.com', email_confirmed_at: '2026-01-01' }
const supabaseUrl = 'https://example.supabase.co'

function appWith(supabase, admins = 'owner@example.com') {
  return createApp({
    supabase,
    supabaseUrl,
    admins: parseAdminEmails(admins),
    starter,
    clientDistPath: 'dist/frontend',
  })
}

describe('health and catalog', () => {
  it('reports configuration flags', async () => {
    const res = await request(appWith(null, '')).get('/api/health')
    expect(res.body).toEqual({ status: 'ok', supabaseConfigured: false, adminConfigured: false })
  })
  it('serves the starter catalogue without Supabase', async () => {
    const res = await request(appWith(null)).get('/api/catalog')
    expect(res.status).toBe(200)
    expect(res.body.products[0].id).toBe('demo')
  })
  it('maps old_price to oldPrice for live products', async () => {
    const supabase = fakeSupabase({ results: {
      products: { data: [{ id: 'a', name: 'A', price: 100, old_price: 150 }], error: null },
      categories: { data: [{ name: 'C' }], error: null },
    } })
    const res = await request(appWith(supabase)).get('/api/catalog')
    expect(res.body.products[0]).toMatchObject({ id: 'a', old_price: 150, oldPrice: 150 })
  })
  it('includes images in the live catalogue select and defaults a missing gallery from image_url', async () => {
    const supabase = fakeSupabase({ results: {
      products: { data: [
        { id: 'a', name: 'A', price: 100, old_price: null, image_url: 'https://x/a.png', images: ['https://x/a.png', 'https://x/b.png'] },
        { id: 'b', name: 'B', price: 100, old_price: null, image_url: 'https://x/c.png' },
        { id: 'c', name: 'C', price: 100, old_price: null, image_url: null, images: null },
      ], error: null },
      categories: { data: [{ name: 'C' }], error: null },
    } })
    const res = await request(appWith(supabase)).get('/api/catalog')
    const select = supabase.calls.find((call) => call.table === 'products').ops.find(([op]) => op === 'select')[1][0]
    expect(select).toMatch(/\bimages\b/)
    expect(res.body.products.map((product) => product.images)).toEqual([['https://x/a.png', 'https://x/b.png'], ['https://x/c.png'], []])
  })
  const missing = (column) => ({ data: null, error: { code: '42703', message: `column products.${column} does not exist` } })
  const selectsOf = (supabase) => supabase.calls.filter((call) => call.table === 'products').map((call) => call.ops.find(([op]) => op === 'select')[1][0])

  it('keeps brand, rx_required and sort_order when only images is missing', async () => {
    const supabase = fakeSupabase({ results: {
      products: (index) => index === 0
        ? missing('images')
        : { data: [{ id: 'a', name: 'A', price: 100, old_price: null, image_url: 'https://x/a.png', brand: 'Pfizer', rx_required: true, sort_order: 4 }], error: null },
      categories: { data: [{ name: 'C' }], error: null },
    } })
    const res = await request(appWith(supabase)).get('/api/catalog')
    expect(res.status).toBe(200)
    expect(res.body.products[0]).toMatchObject({ id: 'a', brand: 'Pfizer', rx_required: true, sort_order: 4, images: ['https://x/a.png'], oldPrice: null })
    const selects = selectsOf(supabase)
    expect(selects).toHaveLength(2)
    expect(selects[1]).not.toMatch(/\bimages\b/)
    expect(selects[1]).toMatch(/rx_required/)
  })
  it('falls back to defaults when migration 001 is missing too', async () => {
    const supabase = fakeSupabase({ results: {
      products: (index) => index === 0 ? missing('images')
        : index === 1 ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'rx_required' column of 'products' in the schema cache" } }
          : { data: [{ id: 'a', name: 'A', price: 100, old_price: null, image_url: 'https://x/a.png' }], error: null },
      categories: { data: [{ name: 'C' }], error: null },
    } })
    const res = await request(appWith(supabase)).get('/api/catalog')
    expect(res.status).toBe(200)
    expect(res.body.products[0]).toMatchObject({ id: 'a', brand: '', rx_required: false, sort_order: 0, images: ['https://x/a.png'] })
    const selects = selectsOf(supabase)
    expect(selects).toHaveLength(3)
    expect(selects[2]).not.toMatch(/images|brand|rx_required|sort_order/)
  })
  it('caches the discovered column set so later requests do not retry', async () => {
    const supabase = fakeSupabase({ results: {
      products: (index) => index === 0 ? missing('images')
        : { data: [{ id: 'a', name: 'A', price: 100, old_price: null, image_url: null, brand: 'B', rx_required: true, sort_order: 1 }], error: null },
      categories: { data: [], error: null },
    } })
    const app = appWith(supabase)
    await request(app).get('/api/catalog')
    const second = await request(app).get('/api/catalog')
    expect(second.status).toBe(200)
    expect(second.body.products[0].rx_required).toBe(true)
    const selects = selectsOf(supabase)
    expect(selects).toHaveLength(3)
    expect(selects[2]).not.toMatch(/\bimages\b/)
    // a fresh app starts uncached and probes the full column set again
    const fresh = fakeSupabase({ results: { products: { data: [], error: null }, categories: { data: [], error: null } } })
    await request(appWith(fresh)).get('/api/catalog')
    expect(selectsOf(fresh)[0]).toMatch(/\bimages\b/)
  })
  it('answers 503 when every step fails with missing columns, or the error is unrelated', async () => {
    const failing = fakeSupabase({ results: {
      products: { data: null, error: { code: '42703', message: 'column x does not exist' } },
      categories: { data: [], error: null },
    } })
    expect((await request(appWith(failing)).get('/api/catalog')).status).toBe(503)
    expect(failing.calls.filter((call) => call.table === 'products')).toHaveLength(3)
    const other = fakeSupabase({ results: {
      products: { data: null, error: { code: '08006', message: 'connection refused' } },
      categories: { data: [], error: null },
    } })
    expect((await request(appWith(other)).get('/api/catalog')).status).toBe(503)
    expect(other.calls.filter((call) => call.table === 'products')).toHaveLength(1)
    const loose = fakeSupabase({ results: {
      products: { data: null, error: { message: 'the column family is read-only' } },
      categories: { data: [], error: null },
    } })
    expect((await request(appWith(loose)).get('/api/catalog')).status).toBe(503)
    expect(loose.calls.filter((call) => call.table === 'products')).toHaveLength(1)
  })
})

describe('POST /api/orders validation', () => {
  const valid = { name: 'Ada Okafor', phone: '+234 800 000 0000', address: '12 Example Street', items: [{ productId: 'demo', quantity: 1 }] }
  it('rejects bad input', async () => {
    const app = appWith(null)
    expect((await request(app).post('/api/orders').send({ ...valid, name: 'A' })).status).toBe(400)
    expect((await request(app).post('/api/orders').send({ ...valid, phone: 'abc' })).status).toBe(400)
    expect((await request(app).post('/api/orders').send({ ...valid, items: [] })).status).toBe(400)
    expect((await request(app).post('/api/orders').send({ ...valid, items: [{ productId: 'Bad ID', quantity: 1 }] })).status).toBe(400)
  })
  it('returns 503 for a valid order when Supabase is not configured', async () => {
    expect((await request(appWith(null)).post('/api/orders').send(valid)).status).toBe(503)
  })
  it('rejects orders exceeding stock', async () => {
    const supabase = fakeSupabase({ results: { products: { data: [{ id: 'demo', stock: 0 }], error: null } } })
    const res = await request(appWith(supabase)).post('/api/orders').send(valid)
    expect(res.status).toBe(409)
  })
})

describe('admin authentication', () => {
  const supabase = () => fakeSupabase({ user: adminUser })
  it('401 without a token, 401 with a bad token', async () => {
    const app = appWith(supabase())
    expect((await request(app).get('/api/admin/me')).status).toBe(401)
    expect((await request(app).get('/api/admin/me').set('Authorization', 'Bearer nope')).status).toBe(401)
  })
  it('403 for a valid user who is not an admin', async () => {
    const app = appWith(supabase(), 'someone-else@example.com')
    const res = await request(app).get('/api/admin/me').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(403)
  })
  it('200 for an approved admin', async () => {
    const res = await request(appWith(supabase())).get('/api/admin/me').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('owner@example.com')
  })
  it('503 when no admins are configured', async () => {
    const res = await request(appWith(supabase(), '')).get('/api/admin/me').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(503)
  })
})

describe('admin products', () => {
  const body = {
    id: 'new-item', name: 'New Item', category: 'Medicines & pain relief', detail: '', price: 500,
    old_price: null, tag: '', art: 'tube', color: 'mint', image_url: null, stock: 5,
    is_active: true, featured: false, brand: 'Vitalight', rx_required: true,
  }
  it('creates a product with the new fields', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { products: { data: [{ ...body }], error: null } } })
    const res = await request(appWith(supabase)).post('/api/admin/products').set('Authorization', 'Bearer good-token').send(body)
    expect(res.status).toBe(201)
    const insert = supabase.calls.flatMap((c) => c.ops).find(([name]) => name === 'insert')
    expect(insert[1][0]).toMatchObject({ id: 'new-item', brand: 'Vitalight', rx_required: true })
  })
  it('PUT does not overwrite optional fields that were not sent', async () => {
    const { id: _id, brand: _b, rx_required: _r, ...legacy } = body
    const supabase = fakeSupabase({ user: adminUser, results: { products: { data: [{ id: 'new-item' }], error: null } } })
    const res = await request(appWith(supabase)).put('/api/admin/products/new-item').set('Authorization', 'Bearer good-token').send(legacy)
    expect(res.status).toBe(200)
    const update = supabase.calls.flatMap((c) => c.ops).find(([name]) => name === 'update')
    expect('rx_required' in update[1][0]).toBe(false)
    expect('brand' in update[1][0]).toBe(false)
  })
  describe('without the images column (migration 003 missing)', () => {
    const gallery = [`${supabaseUrl}/storage/v1/object/public/product-images/new-item/a.png`, `${supabaseUrl}/storage/v1/object/public/product-images/new-item/b.png`]
    const noColumn = { data: null, error: { code: 'PGRST204', message: "Could not find the 'images' column of 'products' in the schema cache" } }
    const writes = (supabase, name) => supabase.calls.flatMap((c) => c.ops).filter(([op]) => op === name).map(([, args]) => args[0])
    it('POST retries once without images and keeps image_url', async () => {
      const supabase = fakeSupabase({ user: adminUser, results: { products: (index) => index === 0 ? noColumn : { data: [{ id: 'new-item', image_url: gallery[0] }], error: null } } })
      const res = await request(appWith(supabase)).post('/api/admin/products').set('Authorization', 'Bearer good-token').send({ ...body, images: gallery })
      expect(res.status).toBe(201)
      expect(res.body.product.id).toBe('new-item')
      expect('images' in res.body.product).toBe(false)
      const inserts = writes(supabase, 'insert')
      expect(inserts).toHaveLength(2)
      expect(inserts[0].images).toEqual(gallery)
      expect('images' in inserts[1]).toBe(false)
      expect(inserts[1].image_url).toBe(gallery[0])
    })
    it('PUT retries once without images and keeps image_url', async () => {
      const missing = { data: null, error: { code: '42703', message: 'column "images" of relation "products" does not exist' } }
      const supabase = fakeSupabase({ user: adminUser, results: { products: (index) => index === 0 ? missing : { data: [{ id: 'new-item', image_url: gallery[0] }], error: null } } })
      const res = await request(appWith(supabase)).put('/api/admin/products/new-item').set('Authorization', 'Bearer good-token').send({ ...body, images: gallery })
      expect(res.status).toBe(200)
      const updates = writes(supabase, 'update')
      expect(updates).toHaveLength(2)
      expect('images' in updates[1]).toBe(false)
      expect(updates[1].image_url).toBe(gallery[0])
    })
    it('does not retry forever or for unrelated errors', async () => {
      const supabase = fakeSupabase({ user: adminUser, results: { products: noColumn } })
      const res = await request(appWith(supabase)).post('/api/admin/products').set('Authorization', 'Bearer good-token').send({ ...body, images: gallery })
      expect(res.status).toBe(500)
      expect(writes(supabase, 'insert')).toHaveLength(2)
      const other = fakeSupabase({ user: adminUser, results: { products: { data: null, error: { code: '42703', message: 'column products.brand does not exist' } } } })
      const res2 = await request(appWith(other)).post('/api/admin/products').set('Authorization', 'Bearer good-token').send({ ...body, images: gallery })
      expect(res2.status).toBe(500)
      expect(writes(other, 'insert')).toHaveLength(1)
    })
    it('rejects gallery urls from another product folder', async () => {
      const other = `${supabaseUrl}/storage/v1/object/public/product-images/someone-else/a.png`
      const post = await request(appWith(fakeSupabase({ user: adminUser }))).post('/api/admin/products').set('Authorization', 'Bearer good-token').send({ ...body, images: [other] })
      expect(post.status).toBe(400)
      const put = await request(appWith(fakeSupabase({ user: adminUser }))).put('/api/admin/products/new-item').set('Authorization', 'Bearer good-token').send({ ...body, images: [other] })
      expect(put.status).toBe(400)
    })
  })
  it('rejects an unknown art key', async () => {
    const supabase = fakeSupabase({ user: adminUser })
    const res = await request(appWith(supabase)).post('/api/admin/products').set('Authorization', 'Bearer good-token').send({ ...body, art: 'unicorn' })
    expect(res.status).toBe(400)
  })
  it('unknown admin routes return 404 for admins', async () => {
    const res = await request(appWith(fakeSupabase({ user: adminUser }))).get('/api/admin/nothing').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/orders with a database', () => {
  const valid = { name: 'Ada Okafor', phone: '+234 800 000 0000', address: '12 Example Street', items: [{ productId: 'demo', quantity: 2 }] }
  it('creates an order whose items carry name and price', async () => {
    const supabase = fakeSupabase({ results: {
      products: { data: [{ id: 'demo', name: 'Demo', price: 100, stock: 10 }], error: null },
      orders: { data: [{ id: 'order-1' }], error: null },
    } })
    const res = await request(appWith(supabase)).post('/api/orders').send(valid)
    expect(res.status).toBe(201)
    expect(res.body.orderId).toBe('order-1')
    const insert = supabase.calls.flatMap((c) => c.ops).find(([name]) => name === 'insert')
    expect(insert[1][0].items).toEqual([{ productId: 'demo', name: 'Demo', price: 100, quantity: 2 }])
  })
  it('rejects duplicate product lines', async () => {
    const supabase = fakeSupabase()
    const items = [{ productId: 'a', quantity: 5 }, { productId: 'a', quantity: 5 }]
    const res = await request(appWith(supabase)).post('/api/orders').send({ ...valid, items })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/each product once/i)
    expect(supabase.calls.length).toBe(0)
  })
})

describe('admin route authentication sweep', () => {
  const supabase = fakeSupabase({ user: adminUser })
  const auth = createAuth({ supabase, admins: parseAdminEmails('owner@example.com') })
  const routes = adminRoutes({ supabase, supabaseUrl, auth }).stack
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods).map((method) => ({ method, path: layer.route.path })))

  it('discovers every admin route', () => {
    expect(routes.length).toBeGreaterThanOrEqual(13)
  })
  it.each(routes.map((route) => [`${route.method.toUpperCase()} ${route.path}`, route]))('%s requires authentication', async (_label, { method, path }) => {
    const res = await request(appWith(supabase))[method](`/api/admin${path.replace(/:\w+/g, 'x')}`)
    expect(res.status).toBe(401)
  })
})
