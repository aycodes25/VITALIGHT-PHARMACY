export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const IMAGE_TYPES = {
  'image/jpeg': { extension: 'jpg', signature: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', signature: (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/webp': { extension: 'webp', signature: (bytes) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' },
}

// Returns { contentType, extension } when the bytes are a real JPEG, PNG or WebP, otherwise null.
export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null
  for (const [contentType, type] of Object.entries(IMAGE_TYPES)) {
    if (type.signature(buffer)) return { contentType, extension: type.extension }
  }
  return null
}
