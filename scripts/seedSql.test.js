import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildSeedSql, LEGACY_PRODUCT_IDS } from './seedSql.js'
import { products, categories } from '../shared/catalog.js'
import { ART_KEYS } from '../shared/artKeys.js'

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

  it('updates only catalogue-owned fields of the legacy products', () => {
    const start = sql.indexOf('update public.products')
    expect(start).toBeGreaterThan(-1)
    const stmt = sql.slice(start, sql.indexOf(';', start))
    expect(LEGACY_PRODUCT_IDS).toHaveLength(7)
    for (const id of LEGACY_PRODUCT_IDS) expect(stmt).toContain(`'${id}'`)
    for (const col of ['price', 'stock', 'image_url', 'is_active']) expect(stmt).not.toContain(col)
  })
})

describe('migration 001', () => {
  const m = readFileSync(new URL('../supabase/migrations/001_catalogue_v2.sql', import.meta.url), 'utf8')
  it('allows every art key', () => {
    for (const k of ART_KEYS) expect(m).toContain(`'${k}'`)
  })
  it('guards each rename and cleans up legacy categories', () => {
    expect(m.split('and not exists (select 1 from public.categories where name =').length - 1).toBe(4)
    expect(m).toContain('delete from public.categories')
  })
})
