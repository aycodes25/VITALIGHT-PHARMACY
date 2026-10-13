import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { uploadProductImages } from './uploadProductImages.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const folder = args.find((arg) => !arg.startsWith('--'))

if (!folder) {
  console.error('Usage: node scripts/upload-product-images.js <folder> [--dry-run]')
  process.exit(1)
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env before uploading photos.')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

try {
  const summary = await uploadProductImages({ supabase, folder, dryRun })
  const rows = [
    ...summary.matched.map(({ file, productId }) => ({ status: dryRun ? 'would upload' : 'matched', file, detail: productId })),
    ...summary.unmatched.map((file) => ({ status: 'unmatched', file, detail: 'no product with this id' })),
    ...summary.invalid.map(({ file, reason }) => ({ status: 'invalid', file, detail: reason })),
    ...summary.failed.map(({ file, reason }) => ({ status: 'failed', file, detail: reason })),
  ]
  if (rows.length) console.table(rows)
  else console.log('No files found in that folder.')
  console.log(dryRun
    ? `Dry run: ${summary.matched.length} photo(s) would be uploaded. Nothing was changed.`
    : `Updated ${summary.updated.length} product photo(s).${summary.dropped ? ` ${summary.dropped} older photo${summary.dropped === 1 ? '' : 's'} dropped from gallery (8 photo limit).` : ''}`)
  if (summary.failed.length) process.exitCode = 1
} catch (error) {
  console.error(`Upload failed: ${error.message}`)
  process.exit(1)
}
