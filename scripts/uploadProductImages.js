import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { MAX_IMAGE_BYTES, detectImageType } from '../backend/lib/images.js'
import { isMissingColumn } from '../backend/lib/dbErrors.js'

const BUCKET = 'product-images'
const MAX_PHOTOS = 8
const FILE_PATTERN = /^(.+)\.(jpe?g|png|webp)$/i

// Pure: decide what to do with each filename. Files are named <product-id>.jpg|jpeg|png|webp.
export function planUploads(filenames, knownProductIds) {
  const known = new Set(knownProductIds)
  const matches = []
  const unmatched = []
  const invalid = []
  const claimed = new Set()
  for (const file of filenames) {
    const found = FILE_PATTERN.exec(file)
    if (!found) {
      invalid.push({ file, reason: 'Not a .jpg, .jpeg, .png or .webp file.' })
      continue
    }
    const productId = found[1]
    if (!known.has(productId)) {
      unmatched.push(file)
      continue
    }
    if (claimed.has(productId)) {
      invalid.push({ file, reason: `More than one photo for "${productId}"; keep a single file per product.` })
      continue
    }
    claimed.add(productId)
    matches.push({ file, productId })
  }
  return { matches, unmatched, invalid }
}

export async function uploadProductImages({ supabase, folder, dryRun = false }) {
  // images (migration 003) may not exist yet; fall back to the legacy column list.
  let galleryColumn = true
  let { data: products, error: listError } = await supabase.from('products').select('id, image_url, images')
  if (listError && isMissingColumn(listError)) {
    galleryColumn = false
    ;({ data: products, error: listError } = await supabase.from('products').select('id, image_url'))
  }
  if (listError) throw new Error(`Could not read the product list: ${listError.message}`)
  const entries = await readdir(folder, { withFileTypes: true })
  const filenames = entries.filter((entry) => entry.isFile() && !entry.name.startsWith('.')).map((entry) => entry.name).sort()
  const existingPhotos = new Map(products.map((product) => [product.id, [
    ...(Array.isArray(product.images) ? product.images : []),
    ...(product.image_url ? [product.image_url] : []),
  ]]))
  const plan = planUploads(filenames, products.map((product) => product.id))

  const summary = { dryRun, matched: [], unmatched: plan.unmatched, invalid: [...plan.invalid], updated: [], failed: [], dropped: 0 }
  for (const { file, productId } of plan.matches) {
    const filePath = path.join(folder, file)
    const { size } = await stat(filePath)
    if (size > MAX_IMAGE_BYTES) {
      summary.invalid.push({ file, reason: 'Larger than 5 MB.' })
      continue
    }
    const bytes = await readFile(filePath)
    const type = detectImageType(bytes)
    if (!type) {
      summary.invalid.push({ file, reason: 'The file is not a real JPEG, PNG or WebP image.' })
      continue
    }
    summary.matched.push({ file, productId })
    if (dryRun) continue
    try {
      // Content-addressed name: the same bytes always map to the same object and URL, so a re-run
      // replaces the object in place and the URL dedupe below keeps the gallery free of duplicates.
      const digest = createHash('sha1').update(bytes).digest('hex')
      const objectPath = `${productId}/${digest}.${type.extension}`
      const { error: uploadError } = await supabase.storage.from(BUCKET)
        .upload(objectPath, bytes, { contentType: type.contentType, upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
      const allPhotos = [...new Set([data.publicUrl, ...(existingPhotos.get(productId) ?? [])])]
      const images = allPhotos.slice(0, MAX_PHOTOS)
      const dropped = allPhotos.length - images.length
      let updateError = null
      if (galleryColumn) {
        ;({ error: updateError } = await supabase.from('products').update({ image_url: data.publicUrl, images }).eq('id', productId))
        // Only a missing column means "no gallery"; any other error fails just this product.
        if (updateError && isMissingColumn(updateError)) {
          galleryColumn = false
          updateError = null
        }
      }
      if (!galleryColumn) {
        ;({ error: updateError } = await supabase.from('products').update({ image_url: data.publicUrl }).eq('id', productId))
      }
      if (updateError) throw updateError
      summary.dropped += dropped
      existingPhotos.set(productId, images)
      summary.updated.push({ file, productId, imageUrl: data.publicUrl })
    } catch (error) {
      summary.failed.push({ file, reason: error.message })
    }
  }
  return summary
}
