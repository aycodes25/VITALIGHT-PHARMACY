import { describe, expect, it, vi } from 'vitest'
import { saveProductWithPhotos } from './saveProductWithPhotos.js'

const url = (name) => `https://x.supabase.co/storage/v1/object/public/product-images/p1/${name}.png`
const file = (name) => ({ name, size: 10, type: 'image/png' })

// A tiny in-memory API: products keep whatever the PUT/POST sent, like the real database would.
function setup({ withGallery = true, failUploads = [], failFinalPut = false, current = () => true } = {}) {
  const calls = []
  const store = (payload) => {
    const { images, ...rest } = payload
    return withGallery ? { ...rest, images: images ?? [] } : rest
  }
  const deps = {
    createProduct: vi.fn(async (payload) => { calls.push(['create', payload]); return { product: store(payload) } }),
    updateProduct: vi.fn(async (id, payload) => {
      calls.push(['update', id, payload])
      if (failFinalPut && calls.filter((c) => c[0] === 'update').length === 2) throw new Error('network down')
      return { product: store(payload) }
    }),
    uploadImage: vi.fn(async (id, f) => {
      calls.push(['upload', id, f.name])
      if (failUploads.includes(f.name)) throw new Error(`${f.name} was rejected`)
      return url(f.name)
    }),
    isStillCurrent: vi.fn(current),
    onProgress: vi.fn(),
  }
  return { deps, calls }
}

const base = { payload: { id: 'p1', name: 'P' }, editingProductId: null, keptPhotos: [], newFiles: [], galleryAvailable: true }

describe('saveProductWithPhotos', () => {
  it('create: POST, sequential uploads, then a final PUT with kept + uploaded', async () => {
    const { deps, calls } = setup()
    const result = await saveProductWithPhotos({ ...base, keptPhotos: [], newFiles: [file('a'), file('b')], ...deps })
    expect(calls.map((c) => c[0])).toEqual(['create', 'upload', 'upload', 'update'])
    expect(calls[0][1].images).toEqual([])
    expect(calls[3][2].images).toEqual([url('a'), url('b')])
    expect(result.product.images).toEqual([url('a'), url('b')])
    expect(result.keptPhotos).toEqual([url('a'), url('b')])
    expect(result.failed).toEqual([])
    expect(result.productId).toBe('p1')
    expect(result.message).toBe('Product saved with its photos.')
    expect(deps.onProgress).toHaveBeenCalledWith('Uploading photo 1 of 2…')
  })

  it('edit: PUT with the kept order first, then uploads, then a final PUT', async () => {
    const { deps, calls } = setup()
    const kept = [url('k2'), url('k1')]
    const result = await saveProductWithPhotos({ ...base, editingProductId: 'p1', keptPhotos: kept, newFiles: [file('n')], ...deps })
    expect(calls.map((c) => c[0])).toEqual(['update', 'upload', 'update'])
    expect(calls[0][2].images).toEqual(kept)
    expect(calls[2][2].images).toEqual([...kept, url('n')])
    expect(result.keptPhotos).toEqual([...kept, url('n')])
  })

  it('saves only once when there are no new files', async () => {
    const { deps, calls } = setup()
    const result = await saveProductWithPhotos({ ...base, editingProductId: 'p1', keptPhotos: [url('k')], ...deps })
    expect(calls.map((c) => c[0])).toEqual(['update'])
    expect(result.message).toBe('Product saved.')
  })

  it('partial failure keeps the product, merges successful uploads and lists failures', async () => {
    const { deps, calls } = setup({ failUploads: ['b'] })
    const result = await saveProductWithPhotos({ ...base, newFiles: [file('a'), file('b')], ...deps })
    expect(calls.map((c) => c[0])).toEqual(['create', 'upload', 'upload', 'update'])
    expect(result.keptPhotos).toEqual([url('a')])
    expect(result.failed.map((item) => item.file.name)).toEqual(['b'])
    expect(result.failed[0].reason).toMatch(/rejected/)
    expect(result.productId).toBe('p1')
  })

  it('does no final PUT when every upload failed, and a retry edits instead of creating again', async () => {
    const first = setup({ failUploads: ['a'] })
    const result = await saveProductWithPhotos({ ...base, newFiles: [file('a')], ...first.deps })
    expect(first.calls.map((c) => c[0])).toEqual(['create', 'upload'])
    expect(result.failed).toHaveLength(1)
    // The UI now edits the saved product id with only the failed file left.
    const retry = setup()
    const again = await saveProductWithPhotos({ ...base, editingProductId: result.productId, keptPhotos: result.keptPhotos, newFiles: result.failed.map((item) => item.file), ...retry.deps })
    expect(retry.deps.createProduct).not.toHaveBeenCalled()
    expect(again.keptPhotos).toEqual([url('a')])
  })

  it('keeps uploaded photos in the result when the final PUT fails', async () => {
    const { deps } = setup({ failFinalPut: true })
    const result = await saveProductWithPhotos({ ...base, editingProductId: 'p1', newFiles: [file('a')], ...deps })
    expect(result.keptPhotos).toEqual([url('a')])
    expect(result.error).toMatch(/network down/)
    expect(result.productId).toBe('p1')
  })

  describe('legacy mode (no images column)', () => {
    it('accepts one photo which replaces the main photo, and rejects the rest', async () => {
      const { deps, calls } = setup({ withGallery: false })
      const result = await saveProductWithPhotos({ ...base, galleryAvailable: false, keptPhotos: [url('old')], newFiles: [file('a'), file('b')], ...deps })
      expect(calls.filter((c) => c[0] === 'upload')).toHaveLength(1)
      expect(calls[0][1]).not.toHaveProperty('images')
      expect(calls[0][1].image_url).toBe(url('old'))
      const last = calls[calls.length - 1]
      expect(last[2].image_url).toBe(url('a'))
      expect(last[2]).not.toHaveProperty('images')
      expect(result.legacy).toBe(true)
      expect(result.rejected.map((f) => f.name)).toEqual(['b'])
      expect(result.keptPhotos).toEqual([url('a')])
      expect(result.message).toMatch(/only the main photo/i)
      expect(result.message).toMatch(/migration 003/)
    })

    it('detects a missing gallery column from a response without images even when it was assumed available', async () => {
      const { deps, calls } = setup({ withGallery: false })
      const result = await saveProductWithPhotos({ ...base, galleryAvailable: true, newFiles: [file('a'), file('b')], ...deps })
      expect(result.legacy).toBe(true)
      expect(calls.filter((c) => c[0] === 'upload')).toHaveLength(1)
      expect(calls[calls.length - 1][2].image_url).toBe(url('a'))
      expect(calls[calls.length - 1][2]).not.toHaveProperty('images')
    })

    it('keeps the old main photo when the single upload fails', async () => {
      const { deps, calls } = setup({ withGallery: false, failUploads: ['a'] })
      const result = await saveProductWithPhotos({ ...base, galleryAvailable: false, keptPhotos: [url('old')], newFiles: [file('a')], ...deps })
      expect(calls.map((c) => c[0])).toEqual(['create', 'upload'])
      expect(result.keptPhotos).toEqual([url('old')])
      expect(result.failed).toHaveLength(1)
    })
  })

  describe('stale guard', () => {
    it('stops after the product save when the dialog is no longer current', async () => {
      const { deps, calls } = setup({ current: () => false })
      const result = await saveProductWithPhotos({ ...base, newFiles: [file('a')], ...deps })
      expect(result).toEqual({ aborted: true })
      expect(calls.map((c) => c[0])).toEqual(['create'])
      expect(deps.isStillCurrent).toHaveBeenCalledWith('p1')
    })

    it('stops between uploads', async () => {
      const { deps, calls } = setup()
      let checks = 0
      deps.isStillCurrent.mockImplementation(() => ++checks < 2)
      const result = await saveProductWithPhotos({ ...base, newFiles: [file('a'), file('b')], ...deps })
      expect(result).toEqual({ aborted: true })
      expect(calls.filter((c) => c[0] === 'upload')).toHaveLength(1)
      expect(calls.filter((c) => c[0] === 'update')).toHaveLength(0)
    })
  })
})
