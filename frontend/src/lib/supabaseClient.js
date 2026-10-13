import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Null when Supabase is not configured; the storefront then works as guest-only.
export const supabaseClient = url && anonKey ? createClient(url, anonKey) : null
