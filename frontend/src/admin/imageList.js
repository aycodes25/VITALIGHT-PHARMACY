// Pure helpers for the multi-photo picker in the product dialog.
export const MAX_PHOTOS = 8
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// existingCount: photos already kept on the product. Returns every problem found
// and only the files that can safely be added.
export function validateNewFiles(existingCount, files) {
  const errors = []
  const accepted = []
  let room = MAX_PHOTOS - existingCount
  let overflow = 0
  for (const file of files) {
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      errors.push(`${file.name} is not a JPEG, PNG or WebP image.`)
    } else if (file.size > MAX_PHOTO_BYTES) {
      errors.push(`${file.name} is larger than 5 MB.`)
    } else if (room <= 0) {
      overflow += 1
    } else {
      accepted.push(file)
      room -= 1
    }
  }
  if (overflow) errors.push(`A product can have up to ${MAX_PHOTOS} photos; ${overflow} photo${overflow === 1 ? ' was' : 's were'} not added.`)
  return { ok: errors.length === 0, errors, accepted }
}

export function moveToFirst(list, index) {
  if (!Number.isInteger(index) || index <= 0 || index >= list.length) return [...list]
  return [list[index], ...list.slice(0, index), ...list.slice(index + 1)]
}

export function removeAt(list, index) {
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return [...list]
  return [...list.slice(0, index), ...list.slice(index + 1)]
}

export function buildFinalImages(existing, uploaded) {
  return [...new Set([...existing, ...uploaded])].slice(0, MAX_PHOTOS)
}
