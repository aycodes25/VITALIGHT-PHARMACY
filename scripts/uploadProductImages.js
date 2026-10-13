import { randomUUID } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { MAX_IMAGE_BYTES, detectImageType } from '../server/lib/images.js'

const BUCKET = 'product-images'
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
  const { data: products, error: listError } = await supabase.from('products').select('id')
  if (listError) throw new Error(`Could not read the product list: ${listError.message}`)
  const entries = await readdir(folder, { withFileTypes: true })
  const filenames = entries.filter((entry) => entry.isFile() && !entry.name.startsWith('.')).map((entry) => entry.name).sort()
  const plan = planUploads(filenames, products.map((product) => product.id))

  const summary = { dryRun, matched: [], unmatched: plan.unmatched, invalid: [...plan.invalid], updated: [], failed: [] }
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
      const objectPath = `${productId}/${randomUUID()}.${type.extension}`
      const { error: uploadError } = await supabase.storage.from(BUCKET)
        .upload(objectPath, bytes, { contentType: type.contentType, upsert: false })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
      const { error: updateError } = await supabase.from('products').update({ image_url: data.publicUrl }).eq('id', productId)
      if (updateError) throw updateError
      summary.updated.push({ file, productId, imageUrl: data.publicUrl })
    } catch (error) {
      summary.failed.push({ file, reason: error.message })
    }
  }
  return summary
}
