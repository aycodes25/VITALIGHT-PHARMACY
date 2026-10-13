import { buildFinalImages } from './imageList.js'

const LEGACY_NOTE = 'Only the main photo is stored until database migration 003 is applied, which enables photo galleries.'

// Saves a product and then its new photos, as one sequence the UI can retry safely.
//
//   create: POST product -> upload new files one by one -> final PUT with kept + uploaded
//   edit:   PUT product (kept order) -> uploads -> final PUT
//
// Dependencies are injected so the flow is unit-testable:
//   createProduct(payload) / updateProduct(id, payload) -> { product }
//   uploadImage(productId, file) -> imageUrl
//   isStillCurrent(productId) -> false once the dialog moved on; the flow then stops and returns { aborted: true }
//   onProgress(text)
//
// Resolves with { product, productId, keptPhotos, failed: [{ file, reason }], rejected: [file], legacy, message, error? }.
// The product id lets the caller retry as an edit, so a retry never creates a duplicate product.
export async function saveProductWithPhotos({
  payload,
  editingProductId,
  keptPhotos,
  newFiles,
  galleryAvailable,
  createProduct,
  updateProduct,
  uploadImage,
  isStillCurrent,
  onProgress = () => {},
}) {
  const withPhotos = (base, images, legacyMode) => {
    if (!legacyMode) return { ...base, images }
    const { images: _images, ...rest } = base
    return { ...rest, image_url: images[0] ?? null }
  }

  // Gallery column unavailable (known up front): only the main photo can be stored.
  let legacy = !galleryAvailable
  const firstPayload = withPhotos(payload, keptPhotos, legacy)
  const saved = editingProductId
    ? await updateProduct(editingProductId, firstPayload)
    : await createProduct(firstPayload)
  let product = saved.product
  const productId = product?.id ?? editingProductId ?? payload.id
  // A saved product that comes back without an images key proves the column is missing.
  if (!('images' in product)) legacy = true
  if (!isStillCurrent(productId)) return { aborted: true }

  let files = newFiles
  let rejected = []
  if (legacy && files.length > 1) {
    rejected = files.slice(1)
    files = files.slice(0, 1)
  }

  let kept = legacy ? keptPhotos.slice(0, 1) : keptPhotos
  const failed = []
  const uploaded = []
  for (const [index, file] of files.entries()) {
    onProgress(`Uploading photo ${index + 1} of ${files.length}…`)
    try {
      uploaded.push(await uploadImage(productId, file))
    } catch (uploadError) {
      failed.push({ file, reason: uploadError.message })
    }
    if (!isStillCurrent(productId)) return { aborted: true }
  }

  let error
  if (uploaded.length) {
    // Legacy: the single new photo replaces the main photo. Gallery: it joins the kept list.
    kept = legacy ? [uploaded[0]] : buildFinalImages(keptPhotos, uploaded)
    try {
      const updated = await updateProduct(productId, withPhotos(product, kept, legacy))
      product = updated.product
    } catch (finalError) {
      // Uploaded photos stay in `kept`, so a retry only has to re-send the failures.
      error = finalError.message
    }
    if (!isStillCurrent(productId)) return { aborted: true }
  }

  let message = newFiles.length ? 'Product saved with its photos.' : 'Product saved.'
  if (legacy && (newFiles.length || keptPhotos.length > 1)) message = `Product saved. ${LEGACY_NOTE}`
  if (rejected.length) {
    message = `${message} Only one new photo can be added right now; ${rejected.length} extra photo${rejected.length === 1 ? ' was' : 's were'} not added.`
  }
  return { aborted: false, product, productId, keptPhotos: kept, failed, rejected, legacy, message, ...(error ? { error } : {}) }
}
