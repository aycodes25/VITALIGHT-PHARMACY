// Migration 003 (products.images) may not be applied yet; saving must still work with the main photo.
export const isMissingImagesColumn = (error) => (error?.code === '42703' || error?.code === 'PGRST204')
  && /\bimages\b/.test(error?.message ?? '')

export function withoutImages(value) {
  const { images: _images, ...rest } = value
  return rest
}

export async function insertProduct(supabase, value) {
  const insert = (row) => supabase.from('products').insert(row).select('*').single()
  let result = await insert(value)
  if (result.error && 'images' in value && isMissingImagesColumn(result.error)) {
    result = await insert(withoutImages(value))
  }
  return result
}
