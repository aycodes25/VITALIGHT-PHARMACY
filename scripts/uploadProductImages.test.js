import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { planUploads, uploadProductImages } from './uploadProductImages.js'

const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(16)])
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16)])

const OLD = 'https://x.supabase.co/storage/v1/object/public/product-images/old'

// rows: { id, image_url, images }; hasImages=false simulates a database without migration 003.
function stubSupabase(rows = [{ id: 'paracetamol-500mg' }, { id: 'vitamin-c' }], { hasImages = true } = {}) {
  const uploads = []
  const updates = []
  const missing = { code: '42703', message: 'column products.images does not exist' }
  return {
    uploads,
    updates,
    from: (table) => ({
      select: async (columns) => {
        if (!hasImages && /images/.test(columns)) return { data: null, error: missing }
        return { data: rows, error: null }
      },
      update: (values) => ({
        eq: async (column, id) => {
          if (!hasImages && 'images' in values) return { error: missing }
          updates.push({ table, values, column, id })
          return { error: null }
        },
      }),
    }),
    storage: {
      from: (bucket) => ({
        upload: async (objectPath, _bytes, options) => { uploads.push({ bucket, objectPath, options }); return { error: null } },
        getPublicUrl: (objectPath) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${objectPath}` } }),
      }),
    },
  }
}

describe('planUploads', () => {
  it('matches known ids case-insensitively on the extension and reports the rest', () => {
    const plan = planUploads(['paracetamol-500mg.JPG', 'vitamin-c.webp', 'mystery.png', 'notes.txt', 'vitamin-c.png'], ['paracetamol-500mg', 'vitamin-c'])
    expect(plan.matches).toEqual([
      { file: 'paracetamol-500mg.JPG', productId: 'paracetamol-500mg' },
      { file: 'vitamin-c.webp', productId: 'vitamin-c' },
    ])
    expect(plan.unmatched).toEqual(['mystery.png'])
    expect(plan.invalid.map((item) => item.file)).toEqual(['notes.txt', 'vitamin-c.png'])
    expect(plan.invalid[0].reason).toBeTruthy()
  })
})

describe('uploadProductImages', () => {
  let folder
  beforeEach(async () => { folder = await mkdtemp(path.join(tmpdir(), 'vitalight-photos-')) })
  afterEach(async () => { await rm(folder, { recursive: true, force: true }) })

  it('uploads to <id>/<sha1>.<ext> with upsert and updates image_url', async () => {
    await writeFile(path.join(folder, 'paracetamol-500mg.jpg'), JPG)
    const supabase = stubSupabase()
    const summary = await uploadProductImages({ supabase, folder })
    expect(supabase.uploads).toHaveLength(1)
    expect(supabase.uploads[0].bucket).toBe('product-images')
    expect(supabase.uploads[0].objectPath).toMatch(/^paracetamol-500mg\/[0-9a-f]{40}\.jpg$/)
    expect(supabase.uploads[0].options.upsert).toBe(true)
    expect(supabase.uploads[0].options.contentType).toBe('image/jpeg')
    expect(supabase.updates).toHaveLength(1)
    expect(supabase.updates[0]).toMatchObject({ table: 'products', column: 'id', id: 'paracetamol-500mg' })
    expect(supabase.updates[0].values.image_url).toContain('/product-images/paracetamol-500mg/')
    expect(summary.updated).toHaveLength(1)
  })
  it('puts the new photo first and keeps earlier photos, deduped and capped at 8', async () => {
    await writeFile(path.join(folder, 'vitamin-c.png'), PNG)
    const earlier = Array.from({ length: 8 }, (_, i) => `${OLD}/${i}.png`)
    const supabase = stubSupabase([{ id: 'vitamin-c', image_url: earlier[0], images: earlier }])
    await uploadProductImages({ supabase, folder })
    const { values } = supabase.updates[0]
    expect(values.images).toHaveLength(8)
    expect(values.images[0]).toBe(values.image_url)
    expect(values.image_url).toContain('/product-images/vitamin-c/')
    expect(values.images.slice(1)).toEqual(earlier.slice(0, 7))
  })
  it('is idempotent: re-running the same folder keeps the same URL and no duplicates', async () => {
    await writeFile(path.join(folder, 'vitamin-c.png'), PNG)
    const rows = [{ id: 'vitamin-c', image_url: null, images: [] }]
    const first = stubSupabase(rows)
    await uploadProductImages({ supabase: first, folder })
    const { values } = first.updates[0]
    const second = stubSupabase([{ id: 'vitamin-c', image_url: values.image_url, images: values.images }])
    await uploadProductImages({ supabase: second, folder })
    expect(second.uploads[0].objectPath).toBe(first.uploads[0].objectPath)
    expect(second.updates[0].values.images).toEqual(values.images)
    expect(second.updates[0].values.images).toHaveLength(1)
  })
  it('reports older photos dropped from a full gallery while keeping the new photo first', async () => {
    await writeFile(path.join(folder, 'vitamin-c.png'), PNG)
    const earlier = Array.from({ length: 8 }, (_, i) => `${OLD}/${i}.png`)
    const supabase = stubSupabase([{ id: 'vitamin-c', image_url: earlier[0], images: earlier }])
    const summary = await uploadProductImages({ supabase, folder })
    expect(summary.dropped).toBe(1)
    expect(supabase.updates[0].values.images[0]).toBe(supabase.updates[0].values.image_url)
  })
  it('a transient update error fails that product only and does not disable the gallery', async () => {
    await writeFile(path.join(folder, 'paracetamol-500mg.jpg'), JPG)
    await writeFile(path.join(folder, 'vitamin-c.png'), PNG)
    const supabase = stubSupabase([{ id: 'paracetamol-500mg' }, { id: 'vitamin-c' }])
    const base = supabase.from
    supabase.from = (table) => {
      const builder = base(table)
      return {
        ...builder,
        update: (values) => ({
          eq: async (column, id) => (id === 'paracetamol-500mg'
            ? { error: { code: '08006', message: 'connection reset' } }
            : builder.update(values).eq(column, id)),
        }),
      }
    }
    const summary = await uploadProductImages({ supabase, folder })
    expect(summary.failed.map((item) => item.file)).toEqual(['paracetamol-500mg.jpg'])
    expect(summary.updated.map((item) => item.productId)).toEqual(['vitamin-c'])
    expect(supabase.updates[0].values.images).toHaveLength(1)
  })
  it('keeps a legacy image_url in the gallery when images is empty', async () => {
    await writeFile(path.join(folder, 'vitamin-c.png'), PNG)
    const supabase = stubSupabase([{ id: 'vitamin-c', image_url: `${OLD}/a.png`, images: [] }])
    await uploadProductImages({ supabase, folder })
    const { values } = supabase.updates[0]
    expect(values.images).toEqual([values.image_url, `${OLD}/a.png`])
  })
  it('falls back to image_url only when the images column does not exist', async () => {
    await writeFile(path.join(folder, 'vitamin-c.png'), PNG)
    const supabase = stubSupabase([{ id: 'vitamin-c', image_url: null }], { hasImages: false })
    const summary = await uploadProductImages({ supabase, folder })
    expect(summary.failed).toEqual([])
    expect(summary.updated).toHaveLength(1)
    expect(supabase.updates).toHaveLength(1)
    expect(Object.keys(supabase.updates[0].values)).toEqual(['image_url'])
  })
  it('does nothing in dry-run mode', async () => {
    await writeFile(path.join(folder, 'vitamin-c.png'), PNG)
    const supabase = stubSupabase()
    const summary = await uploadProductImages({ supabase, folder, dryRun: true })
    expect(supabase.uploads).toHaveLength(0)
    expect(supabase.updates).toHaveLength(0)
    expect(summary.matched).toHaveLength(1)
    expect(summary.updated).toHaveLength(0)
  })
  it('rejects a file whose bytes are not a real image', async () => {
    await writeFile(path.join(folder, 'vitamin-c.jpg'), Buffer.from('definitely not an image'))
    const supabase = stubSupabase()
    const summary = await uploadProductImages({ supabase, folder })
    expect(supabase.uploads).toHaveLength(0)
    expect(summary.invalid).toHaveLength(1)
    expect(summary.invalid[0].file).toBe('vitamin-c.jpg')
  })
  it('rejects a file larger than 5 MB', async () => {
    await writeFile(path.join(folder, 'vitamin-c.jpg'), Buffer.concat([JPG, Buffer.alloc(5 * 1024 * 1024)]))
    const supabase = stubSupabase()
    const summary = await uploadProductImages({ supabase, folder })
    expect(supabase.uploads).toHaveLength(0)
    expect(summary.invalid[0].reason).toMatch(/5 MB/)
  })
})
