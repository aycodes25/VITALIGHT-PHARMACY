import { describe, expect, it, vi } from 'vitest'
import { approveItem } from '../../lib/import/approve.js'
import { fakeFetch, publicLookup, PNG_BYTES } from '../helpers/fakeFetch.js'
import { fakeSupabase } from '../fakeSupabase.js'

const supabaseUrl = 'https://example.supabase.co'
const IMG = 'https://cdn.example/a.png'
const item = { id: 'i1', data: { name: 'Vitamin C', images: [IMG, 'https://cdn.example/b.png'] } }
const edits = {
  name: 'Vitamin C 1000mg', detail: 'Immune support', category: 'Vitamins & supplements',
  price: 6200, old_price: null, tag: '', stock: 10, image_urls: [IMG],
}
const inserted = (supabase) => supabase.calls.filter((call) => call.table === 'products')[1].ops.find(([name]) => name === 'insert')[1][0]

function setup({ routes = { [IMG]: PNG_BYTES }, takenIds = [], insertResult, uploadError } = {}) {
  const { fetchImpl, calls } = fakeFetch(routes)
  const supabase = fakeSupabase({
    uploadError,
    results: {
      products: (index) => (index === 0
        ? { data: takenIds.map((id) => ({ id })), error: null }
        : insertResult ?? { data: { id: 'row' }, error: null }),
    },
  })
  return { supabase, fetchCalls: calls, fetchOpts: { fetchImpl, lookup: publicLookup } }
}

describe('approveItem', () => {
  it('re-hosts the image, then inserts the product with the uploaded urls', async () => {
    const { supabase, fetchOpts } = setup()
    const result = await approveItem({ supabase, supabaseUrl, item, edits, fetchOpts })
    expect(result.warnings).toEqual([])
    expect(supabase.uploads).toHaveLength(1)
    expect(supabase.uploads[0].contentType).toBe('image/png')
    const row = inserted(supabase)
    expect(row).toMatchObject({ id: 'vitamin-c-1000mg', name: 'Vitamin C 1000mg', category: 'Vitamins & supplements', price: 6200, stock: 10, is_active: true })
    expect(row.images).toHaveLength(1)
    expect(row.images[0]).toMatch(/^https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/product-images\/vitamin-c-1000mg\/.+\.png$/)
    expect(row.image_url).toBe(row.images[0])
  })

  it('adds a suffix when the product id is already taken', async () => {
    const { supabase, fetchOpts } = setup({ takenIds: ['vitamin-c-1000mg'] })
    await approveItem({ supabase, supabaseUrl, item, edits, fetchOpts })
    expect(inserted(supabase).id).toBe('vitamin-c-1000mg-2')
  })

  it('rejects invalid fields before downloading anything', async () => {
    const { supabase, fetchOpts } = setup()
    await expect(approveItem({ supabase, supabaseUrl, item, edits: { ...edits, category: '' }, fetchOpts }))
      .rejects.toMatchObject({ status: 400, message: 'Choose a valid product category.' })
    expect(supabase.uploads).toHaveLength(0)
  })

  it('ignores image urls that were not found by the scan', async () => {
    const { supabase, fetchOpts } = setup({ routes: { 'https://evil.example/x.png': PNG_BYTES } })
    const result = await approveItem({ supabase, supabaseUrl, item, edits: { ...edits, image_urls: ['https://evil.example/x.png'] }, fetchOpts })
    expect(supabase.uploads).toHaveLength(0)
    expect(inserted(supabase).images).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('still saves the product when an image cannot be downloaded or is not a real image', async () => {
    const { supabase, fetchOpts } = setup({ routes: { [IMG]: '<html>not an image</html>', 'https://cdn.example/b.png': undefined } })
    const result = await approveItem({
      supabase, supabaseUrl, item, edits: { ...edits, image_urls: [IMG, 'https://cdn.example/b.png'] }, fetchOpts,
    })
    expect(result.warnings).toHaveLength(2)
    expect(supabase.uploads).toHaveLength(0)
    expect(inserted(supabase).images).toEqual([])
  })

  it('removes uploaded images again when the insert fails', async () => {
    const { supabase, fetchOpts } = setup({ insertResult: { data: null, error: { code: '23503', message: 'fk' } } })
    await expect(approveItem({ supabase, supabaseUrl, item, edits, fetchOpts })).rejects.toMatchObject({ status: 400 })
    expect(supabase.uploads).toHaveLength(1)
    expect(supabase.removals).toEqual([[supabase.uploads[0].path]])
  })

  it('reports an id collision as a conflict', async () => {
    const { supabase, fetchOpts } = setup({ insertResult: { data: null, error: { code: '23505', message: 'dup' } } })
    await expect(approveItem({ supabase, supabaseUrl, item, edits, fetchOpts })).rejects.toMatchObject({ status: 409 })
  })
})

describe('approveItem hardening', () => {
  it('rejects non-object edits with a 400 and touches nothing', async () => {
    for (const bad of [null, undefined, 'x', 5, []]) {
      const { supabase, fetchOpts } = setup()
      await expect(approveItem({ supabase, supabaseUrl, item, edits: bad, fetchOpts })).rejects.toMatchObject({ status: 400 })
      expect(supabase.calls).toHaveLength(0)
    }
  })

  it('rejects non-string names and details', async () => {
    for (const patch of [{ name: { a: 1 } }, { name: ['Vitamin C'] }, { name: 12345 }, { name: null }, { detail: { a: 1 } }, { detail: 5 }]) {
      const { supabase, fetchOpts } = setup()
      await expect(approveItem({ supabase, supabaseUrl, item, edits: { ...edits, ...patch }, fetchOpts })).rejects.toMatchObject({ status: 400 })
      expect(supabase.uploads).toHaveLength(0)
    }
  })

  it('tolerates a missing or malformed item.data', async () => {
    const bads = [null, { id: 'x' }, { id: 'x', data: null }, { id: 'x', data: 'str' },
      { id: 'x', data: { images: IMG } }, { id: 'x', data: { images: { a: 1 } } }]
    for (const bad of bads) {
      const { supabase, fetchOpts } = setup()
      const result = await approveItem({ supabase, supabaseUrl, item: bad, edits, fetchOpts })
      expect(result.warnings).toEqual([])
      expect(supabase.uploads).toHaveLength(0)
      expect(inserted(supabase).images).toEqual([])
    }
  })

  it('ignores non-string and non-array image_urls', async () => {
    for (const image_urls of [IMG, { 0: IMG }, null, 5, [null, 5, {}, [IMG]]]) {
      const { supabase, fetchOpts } = setup()
      const result = await approveItem({ supabase, supabaseUrl, item, edits: { ...edits, image_urls }, fetchOpts })
      expect(result.warnings).toEqual([])
      expect(supabase.uploads).toHaveLength(0)
    }
  })

  it('caps huge image lists at 8 photos and only fetches allow-listed urls', async () => {
    const urls = Array.from({ length: 30 }, (_, i) => `https://cdn.example/p${i}.png`)
    const routes = Object.fromEntries(urls.map((u) => [u, PNG_BYTES]))
    const { supabase, fetchOpts, fetchCalls } = setup({ routes })
    const big = { id: 'i', data: { images: urls } }
    const junk = Array.from({ length: 50000 }, (_, i) => `https://evil.example/${i}.png`)
    await approveItem({ supabase, supabaseUrl, item: big, edits: { ...edits, image_urls: [...junk, ...urls] }, fetchOpts })
    expect(supabase.uploads).toHaveLength(8)
    expect(fetchCalls.length).toBe(8)
    expect(fetchCalls.every((u) => u.startsWith('https://cdn.example/'))).toBe(true)
  })

  it('keeps ids valid and within 60 characters for hostile names, including with a collision suffix', async () => {
    const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
    const long = 'x'.repeat(50)
    for (const name of ['日本語日本語', 'Café Crème brûlée', '%_%_%', 'a'.repeat(120), long]) {
      const { supabase, fetchOpts } = setup({ takenIds: name === long ? [long] : [] })
      await approveItem({ supabase, supabaseUrl, item, edits: { ...edits, name, image_urls: [] }, fetchOpts })
      const id = inserted(supabase).id
      expect(id).toMatch(ID)
      expect(id.length).toBeLessThanOrEqual(60)
      const like = supabase.calls[0].ops.find(([op]) => op === 'like')
      expect(like[1][1]).toMatch(/^[a-z0-9-]+%$/)
    }
  })

  it('uses a generic warning for non-import failures and survives a failing upload', async () => {
    const { supabase, fetchOpts } = setup({ uploadError: { message: 'secret-bucket-detail internal' } })
    const result = await approveItem({ supabase, supabaseUrl, item, edits, fetchOpts })
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).not.toContain('secret-bucket-detail')
    expect(inserted(supabase).images).toEqual([])
  })

  it('removes uploaded images when the final validation fails', async () => {
    const { supabase, fetchOpts } = setup()
    // The storage helper returns urls under example.supabase.co, so a different configured origin fails the final check.
    await expect(approveItem({ supabase, supabaseUrl: 'https://other.supabase.co', item, edits, fetchOpts })).rejects.toMatchObject({ status: 400 })
    expect(supabase.uploads).toHaveLength(1)
    expect(supabase.removals).toEqual([[supabase.uploads[0].path]])
  })

  it('removes uploaded images when the insert returns an unknown error', async () => {
    const { supabase, fetchOpts } = setup({ insertResult: { data: null, error: { code: 'XX000', message: 'boom' } } })
    await expect(approveItem({ supabase, supabaseUrl, item, edits, fetchOpts })).rejects.toMatchObject({ message: 'boom' })
    expect(supabase.removals).toEqual([[supabase.uploads[0].path]])
  })

  it('does not fetch private addresses (SSRF)', async () => {
    const privateUrl = 'http://127.0.0.1/a.png'
    const { supabase, fetchOpts, fetchCalls } = setup({ routes: { [privateUrl]: PNG_BYTES } })
    const result = await approveItem({
      supabase, supabaseUrl, item: { id: 'i', data: { images: [privateUrl] } }, edits: { ...edits, image_urls: [privateUrl] }, fetchOpts,
    })
    expect(fetchCalls).toEqual([])
    expect(result.warnings).toHaveLength(1)
  })

  it('decides the content type from magic bytes, not headers', async () => {
    const { supabase, fetchOpts } = setup({ routes: { [IMG]: { body: '<html>fake</html>', contentType: 'image/png' } } })
    const result = await approveItem({ supabase, supabaseUrl, item, edits, fetchOpts })
    expect(supabase.uploads).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/not a JPEG, PNG or WebP/)
  })

  it('trims the brand and drops it when empty', async () => {
    const first = setup()
    await approveItem({ supabase: first.supabase, supabaseUrl, item, edits: { ...edits, brand: '  Acme  ' }, fetchOpts: first.fetchOpts })
    expect(inserted(first.supabase).brand).toBe('Acme')
    const second = setup()
    await approveItem({ supabase: second.supabase, supabaseUrl, item, edits: { ...edits, brand: '   ' }, fetchOpts: second.fetchOpts })
    expect(inserted(second.supabase).brand).toBeUndefined()
  })

  it('logs a failed storage cleanup without throwing a different error', async () => {
    const { supabase, fetchOpts } = setup({ insertResult: { data: null, error: { code: '23503', message: 'fk' } } })
    const original = supabase.storage.from
    supabase.storage.from = (bucket) => ({ ...original(bucket), remove: async () => ({ error: { message: 'storage down' } }) })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(approveItem({ supabase, supabaseUrl, item, edits, fetchOpts })).rejects.toMatchObject({ status: 400 })
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('storage down'))
    spy.mockRestore()
  })
})
