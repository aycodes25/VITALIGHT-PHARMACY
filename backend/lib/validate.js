import { ART_KEYS, COLOR_KEYS } from '../../shared/artKeys.js'

const allowedArt = new Set(ART_KEYS)
const allowedColors = new Set(COLOR_KEYS)
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const fail = (error) => ({ error })

export function validateProductInput(body = {}, { supabaseUrl = '', requireId = false } = {}) {
  const { id, name, category, detail, price, old_price, tag, art, color, image_url, stock, is_active, featured } = body

  if (requireId && (typeof id !== 'string' || !ID_PATTERN.test(id) || id.length > 60)) {
    return fail('Use a unique product ID made from lowercase letters, numbers, and hyphens.')
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) {
    return fail('Product names must contain 2 to 120 characters.')
  }
  if (typeof category !== 'string' || category.trim().length < 2 || category.trim().length > 80) {
    return fail('Choose a valid product category.')
  }
  if (typeof detail !== 'string' || detail.trim().length > 240 || !Number.isInteger(price) || price < 0 || price > 100000000) {
    return fail('Enter a description up to 240 characters and a valid whole-number price.')
  }
  if (old_price !== null && old_price !== undefined && (!Number.isInteger(old_price) || old_price < 0 || old_price > 100000000)) {
    return fail('The original price must be a valid whole number or left empty.')
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
    return fail('Stock must be a whole number between 0 and 1,000,000.')
  }
  if (typeof tag !== 'string' || tag.trim().length > 30 || !allowedArt.has(art) || !allowedColors.has(color)) {
    return fail('Choose a valid product badge, illustration, and background colour.')
  }
  if (typeof is_active !== 'boolean' || typeof featured !== 'boolean') {
    return fail('Choose whether this product is active and featured.')
  }
  if (image_url !== null && image_url !== undefined
    && (typeof image_url !== 'string' || !image_url.startsWith(`${supabaseUrl}/storage/v1/object/public/product-images/`))) {
    return fail('Product images must be uploaded to the pharmacy image library.')
  }

  const value = {
    name: name.trim(),
    category: category.trim(),
    detail: detail.trim(),
    price,
    old_price: old_price ?? null,
    tag: tag.trim(),
    art,
    color,
    image_url: image_url || null,
    stock,
    is_active,
    featured,
  }
  if (requireId) value.id = id

  // Optional fields: only validated and included when sent, so older clients
  // editing a product never reset them to defaults.
  if (body.brand !== undefined) {
    if (typeof body.brand !== 'string' || body.brand.trim().length > 60) return fail('Brand names can contain up to 60 characters.')
    value.brand = body.brand.trim()
  }
  if (body.rx_required !== undefined) {
    if (typeof body.rx_required !== 'boolean') return fail('Choose whether this product requires a prescription.')
    value.rx_required = body.rx_required
  }
  if (body.sort_order !== undefined) {
    if (!Number.isInteger(body.sort_order) || body.sort_order < 0 || body.sort_order > 999) {
      return fail('Display order must be a whole number between 0 and 999.')
    }
    value.sort_order = body.sort_order
  }
  return { value }
}
