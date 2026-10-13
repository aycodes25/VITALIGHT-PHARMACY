import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { planUploads, uploadProductImages } from './uploadProductImages.js'

const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(16)])
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16)])

function stubSupabase(ids = ['paracetamol-500mg', 'vitamin-c']) {
  const uploads = []
  const updates = []
  return {
    uploads,
    updates,
    from: (table) => ({
      select: async () => ({ data: ids.map((id) => ({ id })), error: null }),
      update: (values) => ({ eq: async (column, id) => { updates.push({ table, values, column, id }); return { error: null } } }),
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

  it('uploads to <id>/<uuid>.<ext> and updates image_url', async () => {
    await writeFile(path.join(folder, 'paracetamol-500mg.jpg'), JPG)
    const supabase = stubSupabase()
    const summary = await uploadProductImages({ supabase, folder })
    expect(supabase.uploads).toHaveLength(1)
    expect(supabase.uploads[0].bucket).toBe('product-images')
    expect(supabase.uploads[0].objectPath).toMatch(/^paracetamol-500mg\/[0-9a-f-]{36}\.jpg$/)
    expect(supabase.uploads[0].options.contentType).toBe('image/jpeg')
    expect(supabase.updates).toHaveLength(1)
    expect(supabase.updates[0]).toMatchObject({ table: 'products', column: 'id', id: 'paracetamol-500mg' })
    expect(supabase.updates[0].values.image_url).toContain('/product-images/paracetamol-500mg/')
    expect(summary.updated).toHaveLength(1)
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
