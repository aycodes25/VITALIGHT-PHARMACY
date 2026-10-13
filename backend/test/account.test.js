import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { fakeSupabase } from './fakeSupabase.js'

const starter = { products: [], categories: [] }
const customer = { id: 'user-1', email: 'ada@example.com', email_confirmed_at: '2026-01-01' }

function appWith(supabase) {
  return createApp({ supabase, supabaseUrl: 'https://example.supabase.co', starter, clientDistPath: 'dist/frontend' })
}

describe('account routes', () => {
  it('requires a signed-in customer', async () => {
    const supabase = fakeSupabase({ user: customer })
    expect((await request(appWith(supabase)).get('/api/account/orders')).status).toBe(401)
    const bad = await request(appWith(supabase)).get('/api/account/orders').set('Authorization', 'Bearer nope')
    expect(bad.status).toBe(401)
  })

  it('returns only the customer\'s orders, newest first', async () => {
    const supabase = fakeSupabase({
      user: customer,
      results: { orders: { data: [{ id: 'o1', status: 'new', items: [], delivery_address: '12 Example Street', created_at: '2026-02-01' }], error: null } },
    })
    const res = await request(appWith(supabase)).get('/api/account/orders').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(200)
    expect(res.body.orders[0]).toMatchObject({ id: 'o1', address: '12 Example Street' })
    const ops = supabase.calls.find((call) => call.table === 'orders').ops
    expect(ops).toContainEqual(['eq', ['user_id', 'user-1']])
  })

  it('returns an empty profile for a new customer', async () => {
    const supabase = fakeSupabase({ user: customer, results: { customer_profiles: { data: null, error: null } } })
    const res = await request(appWith(supabase)).get('/api/account/profile').set('Authorization', 'Bearer good-token')
    expect(res.body).toEqual({ email: 'ada@example.com', name: '', phone: '', address: '', cart: {}, saved: [] })
  })

  it('saves details and drops malformed basket entries', async () => {
    const supabase = fakeSupabase({ user: customer })
    const res = await request(appWith(supabase)).put('/api/account/profile').set('Authorization', 'Bearer good-token')
      .send({ name: ' Ada ', cart: { 'good-id': 2, 'BAD ID': 1, other: 500 }, saved: ['a', 'a', 'B_'] })
    expect(res.status).toBe(200)
    const upsert = supabase.calls.find((call) => call.table === 'customer_profiles').ops.find(([op]) => op === 'upsert')[1][0]
    expect(upsert).toMatchObject({ user_id: 'user-1', full_name: 'Ada', cart: { 'good-id': 2 }, saved: ['a'] })
  })

  it('rejects an invalid phone number', async () => {
    const supabase = fakeSupabase({ user: customer })
    const res = await request(appWith(supabase)).put('/api/account/profile').set('Authorization', 'Bearer good-token').send({ phone: 'abc' })
    expect(res.status).toBe(400)
  })

  it('links a signed-in customer\'s order to their account but keeps guest orders working', async () => {
    const products = { data: [{ id: 'demo', name: 'Demo', price: 100, stock: 5 }], error: null }
    const body = { name: 'Ada Okafor', phone: '+234 800 000 0000', address: '12 Example Street', items: [{ productId: 'demo', quantity: 1 }] }

    const signedIn = fakeSupabase({ user: customer, results: { products, orders: { data: [{ id: 'o1' }], error: null } } })
    await request(appWith(signedIn)).post('/api/orders').set('Authorization', 'Bearer good-token').send(body).expect(201)
    const insert = signedIn.calls.find((call) => call.table === 'orders').ops.find(([op]) => op === 'insert')[1][0]
    expect(insert.user_id).toBe('user-1')

    const guest = fakeSupabase({ user: customer, results: { products } })
    await request(appWith(guest)).post('/api/orders').send(body).expect(401)
    expect(guest.calls.some((call) => call.table === 'orders')).toBe(false)
  })
})
