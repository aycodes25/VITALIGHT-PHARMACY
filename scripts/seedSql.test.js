import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildSeedSql } from './seedSql.js'
import { products, categories } from '../shared/catalog.js'

describe('buildSeedSql', () => {
  const sql = buildSeedSql()
  it('mentions every product id and category', () => {
    for (const p of products) expect(sql).toContain(`'${p.id}'`)
    for (const c of categories) expect(sql).toContain(c.name.replace(/'/g, "''"))
  })
  it('is idempotent', () => {
    expect(sql).toContain('on conflict (name) do update')
    expect(sql).toContain('on conflict (id) do nothing')
  })
  it('matches the committed migration file', () => {
    const committed = readFileSync(new URL('../supabase/migrations/002_seed_catalogue.sql', import.meta.url), 'utf8')
    expect(committed.replace(/\r\n/g, '\n')).toBe(sql)
  })
})
