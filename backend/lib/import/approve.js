import { randomUUID } from 'node:crypto'
import { validateProductInput } from '../validate.js'
import { insertProduct } from '../productStore.js'
import { MAX_IMAGE_BYTES, detectImageType } from '../images.js'
import { safeFetch } from './safeFetch.js'
import { ImportError } from './urlSafety.js'
import { slugify, uniqueSlug } from './match.js'

const MAX_PHOTOS = 8
const BUCKET = 'product-images'
const DEFAULT_DEADLINE_MS = 20000

const text = (value) => (typeof value === 'string' ? value : value === undefined || value === null ? '' : null)

function draftFrom(edits, id) {
  const name = text(edits.name)
  const detail = text(edits.detail)
  const draft = {
    id,
    // Non-strings stay as-is so validation rejects them instead of coercing "[object Object]".
    name: name === null ? edits.name : name.trim(),
    category: edits.category,
    detail: detail === null ? edits.detail : detail.trim().slice(0, 240),
    price: edits.price,
    old_price: edits.old_price ?? null,
    tag: edits.tag ?? '',
    art: edits.art ?? 'vitamin',
    color: edits.color ?? 'lavender',
    stock: edits.stock ?? 0,
    is_active: edits.is_active ?? true,
    featured: edits.featured ?? false,
  }
  if (typeof edits.brand === 'string' && edits.brand.trim()) draft.brand = edits.brand.trim()
  return draft
}

const removeUploads = (supabase, photos) => (photos.length
  ? Promise.resolve()
    .then(() => supabase.storage.from(BUCKET).remove(photos.map((photo) => photo.path)))
    .then((result) => { if (result?.error) console.error(`Import cleanup could not remove uploaded photos: ${result.error.message ?? result.error}`) })
    .catch((error) => console.error(`Import cleanup could not remove uploaded photos: ${error?.message ?? error}`))
  : Promise.resolve())

async function rehostImage(supabase, productId, url, fetchOpts) {
  const { body } = await safeFetch(url, { ...fetchOpts, maxBytes: MAX_IMAGE_BYTES, accept: 'image/webp,image/png,image/jpeg', timeoutMs: 10000 })
  const type = detectImageType(body)
  if (!type) throw new ImportError('not a JPEG, PNG or WebP image', 502)
  const path = `${productId}/${randomUUID()}.${type.extension}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: type.contentType, upsert: false })
  if (error) throw new Error('upload failed')
  try {
    return { path, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
  } catch {
    await removeUploads(supabase, [{ path }])
    throw new Error('upload failed')
  }
}

// Saves a reviewed item as a real product: picks a free id, re-hosts the chosen photos, inserts the product.
// Only image URLs found by the scan (item.data.images) can be selected. A photo that fails is skipped with a warning.
export async function approveItem({ supabase, supabaseUrl, item, edits, fetchOpts, deadlineMs = DEFAULT_DEADLINE_MS }) {
  if (!edits || typeof edits !== 'object' || Array.isArray(edits)) {
    throw new ImportError('Send the product details to approve.', 400)
  }
  // slugify only emits [a-z0-9-], so the LIKE pattern below can never contain a wildcard.
  const base = slugify(edits.name)
  const { data: rows, error: lookupError } = await supabase.from('products').select('id').like('id', `${base}%`)
  if (lookupError) throw lookupError
  const id = uniqueSlug(base, new Set((Array.isArray(rows) ? rows : []).map((row) => row.id)))

  const draft = draftFrom(edits, id)
  const options = { supabaseUrl, requireId: true, productId: id }
  const early = validateProductInput(draft, options)
  if (early.error) throw new ImportError(early.error, 400)

  const scanned = item?.data?.images
  const allowed = new Set(Array.isArray(scanned) ? scanned.filter((url) => typeof url === 'string') : [])
  const wanted = []
  if (Array.isArray(edits.image_urls)) {
    for (const url of edits.image_urls) {
      if (wanted.length >= MAX_PHOTOS) break
      if (typeof url === 'string' && allowed.has(url) && !wanted.includes(url)) wanted.push(url)
    }
  }
  const warnings = []
  // One shared deadline for every photo: a slow site must not keep the request (and the claim) open.
  let expired = false
  let timer
  const deadline = new Promise((resolve) => { timer = setTimeout(() => { expired = true; resolve('deadline') }, deadlineMs) })
  const rehostOne = async (url) => {
    try {
      const photo = await rehostImage(supabase, id, url, fetchOpts)
      if (expired) {
        await removeUploads(supabase, [photo])
        return null
      }
      return photo
    } catch (error) {
      if (!expired) {
        const reason = error instanceof ImportError ? error.message : 'upload failed'
        warnings.push(`A photo could not be copied (${url}): ${reason}`)
      }
      return null
    }
  }
  const results = await Promise.all(wanted.map(async (url) => {
    const outcome = await Promise.race([rehostOne(url), deadline])
    if (outcome === 'deadline') {
      warnings.push(`A photo could not be copied (${url}): the website took too long`)
      return null
    }
    return outcome
  }))
  clearTimeout(timer)
  const uploaded = results.filter(Boolean)

  try {
    const final = validateProductInput({ ...draft, images: uploaded.map((photo) => photo.url) }, options)
    if (final.error) throw new ImportError(final.error, 400)

    const { data, error } = await insertProduct(supabase, final.value)
    if (error) {
      if (error.code === '23505') throw new ImportError('That product ID is already in use. Try approving again.', 409)
      if (error.code === '23503') throw new ImportError('Create the selected category before approving this product.', 400)
      throw error
    }
    return { product: data, warnings }
  } catch (error) {
    await removeUploads(supabase, uploaded)
    throw error
  }
}
