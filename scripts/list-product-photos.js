import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildChecklistCsv } from './photoChecklist.js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const attempts = [
  'id, name, brand, category, image_url, images, is_active',
  'id, name, brand, category, image_url, is_active',
  'id, name, category, image_url, is_active',
]
let products = null
for (const columns of attempts) {
  const { data, error } = await supabase.from('products').select(columns).eq('is_active', true).order('category').order('name')
  if (!error) { products = data; break }
}
if (!products) {
  console.error('Could not read products from the database.')
  process.exit(1)
}

const target = new URL('../photos-checklist.csv', import.meta.url)
writeFileSync(target, buildChecklistCsv(products))
const missing = products.filter((p) => !p.image_url && !(p.images && p.images.length)).length
console.log(`${products.length} active products, ${missing} still need a photo.`)
console.log('Checklist written to photos-checklist.csv (open it in Excel).')
console.log('Name each photo exactly as in the "filename" column, put them in one folder, then run:')
console.log('  npm run images -- ./photos --dry-run')
