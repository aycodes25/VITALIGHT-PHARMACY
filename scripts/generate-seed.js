import { writeFileSync } from 'node:fs'
import { buildSeedSql } from './seedSql.js'

const target = new URL('../supabase/migrations/002_seed_catalogue.sql', import.meta.url)
writeFileSync(target, buildSeedSql())
console.log(`Wrote ${target.pathname}`)
