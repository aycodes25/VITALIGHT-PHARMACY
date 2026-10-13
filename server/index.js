import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { createApp } from './app.js'
import { parseAdminEmails } from './lib/auth.js'
import { categories, products } from '../shared/catalog.js'

const port = Number(process.env.PORT) || 3001
const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = createApp({
  supabase,
  supabaseUrl,
  admins: parseAdminEmails(process.env.ADMIN_EMAILS),
  starter: { products, categories },
  clientDistPath: path.resolve(__dirname, '..', 'dist', 'storefront'),
})

app.listen(port, () => {
  console.log(`Vitalight Pharmacy server listening on http://localhost:${port}`)
})
