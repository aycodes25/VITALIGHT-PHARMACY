import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { parseAdminEmails } from '../../lib/auth.js'
import { fakeSupabase } from '../fakeSupabase.js'
import { fakeFetch, publicLookup, PNG_BYTES } from '../helpers/fakeFetch.js'

const supabaseUrl = 'https://example.supabase.co'
const adminUser = { id: 'u1', email: 'owner@example.com', email_confirmed_at: '2026-01-01' }
const BATCH = '11111111-1111-4111-8111-111111111111'
const ITEM = '22222222-2222-4222-8222-222222222222'
const batchRow = { id: BATCH, source_url: 'https://shop.example/', platform: '', status: 'scanning', cursor: null }

function appWith(supabase, routes = {}) {
  const { fetchImpl } = fakeFetch(routes)
  return createApp({
    supabase,
    supabaseUrl,
    admins: parseAdminEmails('owner@example.com'),
    starter: { products: [], categories: [] },
    clientDistPath: 'dist/frontend',
    importFetchOpts: { fetchImpl, lookup: publicLookup },
  })
}
const admin = (req) => req.set('Authorization', 'Bearer good-token')
const ops = (supabase, table) => supabase.calls.filter((call) => call.table === table).flatMap((call) => call.ops)

describe('import routes: access', () => {
  it('requires an admin', async () => {
    const supabase = fakeSupabase({ user: adminUser })
    const res = await request(appWith(supabase)).post('/api/admin/import/scan').send({ url: 'https://shop.example/' })
    expect(res.status).toBe(401)
  })
})

describe('POST /scan', () => {
  const shopifyFeed = { 'https://shop.example/products.json?limit=250&page=1': { products: [{ title: 'Zinc', handle: 'zinc', variants: [{ price: '500' }], images: [] }] } }

  it('creates a batch, stores the scanned items and finishes', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_batches: { data: batchRow, error: null }, import_items: { data: [], error: null } } })
    const res = await admin(request(appWith(supabase, shopifyFeed)).post('/api/admin/import/scan')).send({ url: 'https://shop.example/' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ batchId: BATCH, added: 1, done: true, platform: 'shopify', limitReached: false })
    const rows = ops(supabase, 'import_items').find(([name]) => name === 'insert')[1][0]
    expect(rows).toEqual([expect.objectContaining({ batch_id: BATCH, data: expect.objectContaining({ name: 'Zinc', price: 500 }) })])
    const update = ops(supabase, 'import_batches').find(([name]) => name === 'update')[1][0]
    expect(update).toMatchObject({ platform: 'shopify', cursor: null, status: 'ready' })
  })

  it('refuses private addresses without creating a batch', async () => {
    const supabase = fakeSupabase({ user: adminUser })
    const res = await admin(request(appWith(supabase)).post('/api/admin/import/scan')).send({ url: 'http://127.0.0.1/' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/private network/)
    expect(supabase.calls).toHaveLength(0)
  })

  it('removes the new batch and explains when nothing readable is found', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_batches: { data: batchRow, error: null } } })
    const res = await admin(request(appWith(supabase, { 'https://shop.example/': '<html>hello</html>' })).post('/api/admin/import/scan')).send({ url: 'https://shop.example/' })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/does not expose product data/)
    expect(ops(supabase, 'import_batches').some(([name]) => name === 'delete')).toBe(true)
  })

  it('does not rescan a batch that is already finished', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_batches: { data: { ...batchRow, status: 'ready' }, error: null } } })
    const res = await admin(request(appWith(supabase)).post('/api/admin/import/scan')).send({ batchId: BATCH })
    expect(res.body).toMatchObject({ batchId: BATCH, added: 0, done: true })
    expect(ops(supabase, 'import_items')).toEqual([])
  })

  it('tells the owner to apply the migration when the tables are missing', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_batches: { data: null, error: { code: '42P01', message: 'relation does not exist' } } } })
    const res = await admin(request(appWith(supabase)).post('/api/admin/import/scan')).send({ url: 'https://shop.example/' })
    expect(res.status).toBe(503)
    expect(res.body.error).toMatch(/005_import_queue\.sql/)
  })

  it('validates the request body', async () => {
    const supabase = fakeSupabase({ user: adminUser })
    expect((await admin(request(appWith(supabase)).post('/api/admin/import/scan')).send({})).status).toBe(400)
    expect((await admin(request(appWith(supabase)).post('/api/admin/import/scan')).send({ batchId: 'nope' })).status).toBe(400)
  })
})

describe('GET /batches/:id', () => {
  it('returns items with a suggested category and a duplicate hint', async () => {
    const supabase = fakeSupabase({
      user: adminUser,
      results: {
        import_batches: { data: { ...batchRow, status: 'ready' }, error: null },
        import_items: { data: [{ id: ITEM, status: 'pending', product_id: null, data: { name: 'Vitamin C Zinc', source_category: 'Vitamins' } }], error: null },
        categories: { data: [{ name: 'Vitamins & supplements' }, { name: 'Medicines' }], error: null },
        products: { data: [{ id: 'vitamin-c-zinc', name: 'Vitamin C + Zinc' }], error: null },
      },
    })
    const res = await admin(request(appWith(supabase)).get(`/api/admin/import/batches/${BATCH}`))
    expect(res.status).toBe(200)
    expect(res.body.batch.id).toBe(BATCH)
    expect(res.body.items).toEqual([{
      id: ITEM, status: 'pending', product_id: null,
      data: { name: 'Vitamin C Zinc', source_category: 'Vitamins' },
      suggested_category: 'Vitamins & supplements', duplicate: 'Vitamin C + Zinc',
    }])
  })

  it('orders items stably and reports truncation when more than 500 exist', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ id: `id-${i}`, status: 'pending', product_id: null, data: { name: `P${i}` } }))
    const supabase = fakeSupabase({
      user: adminUser,
      results: { import_batches: { data: batchRow, error: null }, import_items: { data: rows, error: null }, categories: { data: [], error: null }, products: { data: [], error: null } },
    })
    const res = await admin(request(appWith(supabase)).get(`/api/admin/import/batches/${BATCH}`))
    expect(res.body.items).toHaveLength(500)
    expect(res.body.truncated).toBe(true)
    const itemOps = ops(supabase, 'import_items')
    expect(itemOps.filter(([name]) => name === 'order').map(([, args]) => args[0])).toEqual(['created_at', 'id'])
    expect(itemOps.find(([name]) => name === 'limit')[1]).toEqual([501])
    expect(ops(supabase, 'products').find(([name]) => name === 'limit')[1]).toEqual([5000])
  })

  it('does not flag truncation for a short list', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_batches: { data: batchRow, error: null }, import_items: { data: [], error: null } } })
    const res = await admin(request(appWith(supabase)).get(`/api/admin/import/batches/${BATCH}`))
    expect(res.body.truncated).toBe(false)
  })

  it('answers 404 for an unknown batch', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_batches: { data: null, error: null } } })
    expect((await admin(request(appWith(supabase)).get(`/api/admin/import/batches/${BATCH}`))).status).toBe(404)
  })
})

describe('GET /batches', () => {
  it('lists recent scans', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_batches: { data: [batchRow], error: null } } })
    const res = await admin(request(appWith(supabase)).get('/api/admin/import/batches'))
    expect(res.body.batches).toEqual([batchRow])
  })
})

describe('POST /items/:id/approve and /reject', () => {
  const IMG = 'https://cdn.example/a.png'
  const pending = { id: ITEM, status: 'approved', data: { name: 'Zinc', images: [IMG] } }
  const edits = { name: 'Zinc 50mg', detail: 'Tablets', category: 'Vitamins & supplements', price: 500, old_price: null, tag: '', stock: 5, image_urls: [IMG] }

  it('approves an item and saves the product', async () => {
    const supabase = fakeSupabase({
      user: adminUser,
      results: {
        import_items: { data: pending, error: null },
        products: (index) => (index === 0 ? { data: [], error: null } : { data: { id: 'zinc-50mg', name: 'Zinc 50mg' }, error: null }),
      },
    })
    const res = await admin(request(appWith(supabase, { [IMG]: PNG_BYTES })).post(`/api/admin/import/items/${ITEM}/approve`)).send(edits)
    expect(res.status).toBe(201)
    expect(res.body.product.id).toBe('zinc-50mg')
    expect(supabase.uploads).toHaveLength(1)
    const updates = ops(supabase, 'import_items').filter(([name]) => name === 'update').map(([, args]) => args[0])
    expect(updates).toEqual([{ status: 'approved' }, { product_id: 'zinc-50mg' }])
  })

  it('puts the item back in the queue when saving fails', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_items: { data: pending, error: null } } })
    const res = await admin(request(appWith(supabase)).post(`/api/admin/import/items/${ITEM}/approve`)).send({ ...edits, category: '' })
    expect(res.status).toBe(400)
    const updates = ops(supabase, 'import_items').filter(([name]) => name === 'update').map(([, args]) => args[0])
    expect(updates).toEqual([{ status: 'approved' }, { status: 'pending' }])
  })

  it('guards the approve claim and the reject update with a pending status check', async () => {
    const approveDb = fakeSupabase({
      user: adminUser,
      results: { import_items: { data: pending, error: null }, products: (index) => (index === 0 ? { data: [], error: null } : { data: { id: 'zinc-50mg' }, error: null }) },
    })
    await admin(request(appWith(approveDb, { [IMG]: PNG_BYTES })).post(`/api/admin/import/items/${ITEM}/approve`)).send(edits)
    const claim = approveDb.calls.find((call) => call.table === 'import_items')
    expect(claim.ops).toContainEqual(['eq', ['status', 'pending']])

    const rejectDb = fakeSupabase({ user: adminUser, results: { import_items: { data: { id: ITEM }, error: null } } })
    await admin(request(appWith(rejectDb)).post(`/api/admin/import/items/${ITEM}/reject`))
    expect(rejectDb.calls.find((call) => call.table === 'import_items').ops).toContainEqual(['eq', ['status', 'pending']])
  })

  it('still answers 201 and does not requeue when linking the product fails', async () => {
    const supabase = fakeSupabase({
      user: adminUser,
      results: {
        import_items: (index) => (index === 0 ? { data: pending, error: null } : { data: null, error: { code: 'XX000', message: 'link failed' } }),
        products: (index) => (index === 0 ? { data: [], error: null } : { data: { id: 'zinc-50mg', name: 'Zinc 50mg' }, error: null }),
      },
    })
    const res = await admin(request(appWith(supabase, { [IMG]: PNG_BYTES })).post(`/api/admin/import/items/${ITEM}/approve`)).send(edits)
    expect(res.status).toBe(201)
    const updates = ops(supabase, 'import_items').filter(([name]) => name === 'update').map(([, args]) => args[0])
    expect(updates).toEqual([{ status: 'approved' }, { product_id: 'zinc-50mg' }])
  })

  it('answers 409 when the item was already handled', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_items: { data: null, error: null } } })
    const res = await admin(request(appWith(supabase)).post(`/api/admin/import/items/${ITEM}/approve`)).send(edits)
    expect(res.status).toBe(409)
  })

  it('rejects an item', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_items: { data: { id: ITEM }, error: null } } })
    const res = await admin(request(appWith(supabase)).post(`/api/admin/import/items/${ITEM}/reject`))
    expect(res.body).toEqual({ rejected: true })
    expect(ops(supabase, 'import_items').find(([name]) => name === 'update')[1][0]).toEqual({ status: 'rejected' })
  })

  it('answers 409 when rejecting an item that is not pending', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_items: { data: null, error: null } } })
    expect((await admin(request(appWith(supabase)).post(`/api/admin/import/items/${ITEM}/reject`))).status).toBe(409)
  })

  it('rejects malformed ids', async () => {
    const supabase = fakeSupabase({ user: adminUser })
    expect((await admin(request(appWith(supabase)).post('/api/admin/import/items/nope/approve')).send(edits)).status).toBe(400)
  })
})

describe('hardening', () => {
  const shopifyFeed = { 'https://shop.example/products.json?limit=250&page=1': { products: [{ title: 'Zinc', handle: 'zinc', variants: [{ price: '500' }], images: [] }] } }
  const scan = (supabase, body, routes = {}) => admin(request(appWith(supabase, routes)).post('/api/admin/import/scan')).send(body)

  it('rejects a url longer than 2000 characters before touching the database', async () => {
    const supabase = fakeSupabase({ user: adminUser })
    const res = await scan(supabase, { url: `https://shop.example/${'a'.repeat(2000)}` })
    expect(res.status).toBe(400)
    expect(supabase.calls).toHaveLength(0)
  })

  it('handles non-object bodies without throwing', async () => {
    const supabase = fakeSupabase({ user: adminUser })
    for (const payload of ['[]', '"text"', 'null', '5']) {
      const res = await admin(request(appWith(supabase)).post('/api/admin/import/scan')).set('Content-Type', 'application/json').send(payload)
      expect(res.status).toBe(400)
    }
    const empty = await admin(request(appWith(supabase)).post('/api/admin/import/scan'))
    expect(empty.status).toBe(400)
  })

  it('does not leak raw errors and removes the batch when storing items fails on the first step', async () => {
    const supabase = fakeSupabase({
      user: adminUser,
      results: { import_batches: { data: batchRow, error: null }, import_items: { data: null, error: { code: 'XX000', message: 'secret internal detail' } } },
    })
    const res = await scan(supabase, { url: 'https://shop.example/' }, shopifyFeed)
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toMatch(/secret/)
    expect(ops(supabase, 'import_batches').some(([name]) => name === 'delete')).toBe(true)
  })

  it('keeps the batch when a later step fails', async () => {
    const supabase = fakeSupabase({
      user: adminUser,
      results: { import_batches: { data: batchRow, error: null }, import_items: { data: null, error: { code: 'XX000', message: 'secret' } } },
    })
    const res = await scan(supabase, { batchId: BATCH }, shopifyFeed)
    expect(res.status).toBe(500)
    expect(ops(supabase, 'import_batches').some(([name]) => name === 'delete')).toBe(false)
  })

  it('does not leak raw errors from approval and requeues the item', async () => {
    const supabase = fakeSupabase({
      user: adminUser,
      results: { import_items: { data: { id: ITEM, status: 'approved', data: { name: 'Z', images: [] } }, error: null }, products: { data: null, error: { code: 'XX000', message: 'secret internal detail' } } },
    })
    const res = await admin(request(appWith(supabase)).post(`/api/admin/import/items/${ITEM}/approve`)).send({ name: 'Zinc' })
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toMatch(/secret/)
    const updates = ops(supabase, 'import_items').filter(([name]) => name === 'update').map(([, args]) => args[0])
    expect(updates).toEqual([{ status: 'approved' }, { status: 'pending' }])
  })

  it('answers 400 for a non-object approve body without claiming the item', async () => {
    const supabase = fakeSupabase({ user: adminUser })
    for (const payload of ['[]', '"x"', 'null']) {
      const res = await admin(request(appWith(supabase)).post(`/api/admin/import/items/${ITEM}/approve`)).set('Content-Type', 'application/json').send(payload)
      expect(res.status).toBe(400)
    }
    expect(supabase.calls).toHaveLength(0)
  })

  it('returns a generic 500 without leaking when updating the batch fails after scanning', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = fakeSupabase({
      user: adminUser,
      results: {
        import_batches: (index) => (index === 0 ? { data: batchRow, error: null } : { data: null, error: { code: 'XX000', message: 'secret batch detail' } }),
        import_items: { data: [], error: null },
      },
    })
    const res = await scan(supabase, { batchId: BATCH }, shopifyFeed)
    spy.mockRestore()
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'The website could not be scanned.' })
    expect(JSON.stringify(res.body)).not.toMatch(/secret/)
  })

  it('hands a bad stored cursor to the scanner, which rejects it without contacting the cursor host', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { import_batches: { data: { ...batchRow, cursor: { kind: 'evil', url: 'http://evil.example/' } }, error: null } } })
    const fake = fakeFetch({})
    const app = createApp({
      supabase, supabaseUrl, admins: parseAdminEmails('owner@example.com'), starter: { products: [], categories: [] },
      clientDistPath: 'dist/frontend', importFetchOpts: { fetchImpl: fake.fetchImpl, lookup: publicLookup },
    })
    const res = await admin(request(app).post('/api/admin/import/scan')).send({ batchId: BATCH })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('This scan can no longer be continued. Start a new scan.')
    expect(fake.calls.some((call) => call.includes('evil.example'))).toBe(false)
  })
})
