import { describe, expect, it } from 'vitest'
import { insertProduct } from '../lib/productStore.js'
import { fakeSupabase } from './fakeSupabase.js'

const insertedRows = (supabase) => supabase.calls
  .filter((call) => call.table === 'products')
  .map((call) => call.ops.find(([name]) => name === 'insert')[1][0])

describe('insertProduct', () => {
  it('inserts once when the images column exists', async () => {
    const supabase = fakeSupabase({ results: { products: { data: { id: 'a' }, error: null } } })
    const { data, error } = await insertProduct(supabase, { id: 'a', images: ['x'] })
    expect(error).toBeNull()
    expect(data).toEqual({ id: 'a' })
    expect(insertedRows(supabase)).toHaveLength(1)
  })

  it('retries without images when migration 003 is missing', async () => {
    const supabase = fakeSupabase({
      results: {
        products: (index) => (index === 0
          ? { data: null, error: { code: '42703', message: 'column "images" of relation "products" does not exist' } }
          : { data: { id: 'a' }, error: null }),
      },
    })
    const { data, error } = await insertProduct(supabase, { id: 'a', images: ['x'] })
    expect(error).toBeNull()
    expect(data).toEqual({ id: 'a' })
    const rows = insertedRows(supabase)
    expect(rows).toHaveLength(2)
    expect(rows[1]).not.toHaveProperty('images')
  })

  it('returns other errors untouched', async () => {
    const supabase = fakeSupabase({ results: { products: { data: null, error: { code: '23505', message: 'duplicate' } } } })
    const { error } = await insertProduct(supabase, { id: 'a' })
    expect(error.code).toBe('23505')
  })
})
