import { describe, expect, it } from 'vitest'
import { findDuplicate, slugify, suggestCategory, uniqueSlug } from '../../lib/import/match.js'

const categories = [{ name: 'Medicines' }, { name: 'Vitamins & supplements' }, { name: 'Personal care' }, { name: 'First aid' }]

describe('suggestCategory', () => {
  it('matches words in the source category or product name, ignoring plurals', () => {
    expect(suggestCategory({ source_category: 'Vitamin C', name: 'Zinc tablets' }, categories)).toBe('Vitamins & supplements')
    expect(suggestCategory({ source_category: '', name: 'Adhesive first aid kit' }, categories)).toBe('First aid')
    expect(suggestCategory({ source_category: 'Medicine', name: 'Paracetamol' }, categories)).toBe('Medicines')
  })

  it('returns an empty string when nothing matches', () => {
    expect(suggestCategory({ source_category: 'Toys', name: 'Puzzle' }, categories)).toBe('')
  })
})

describe('findDuplicate', () => {
  it('matches names ignoring case and punctuation', () => {
    const existing = [{ id: 'a', name: 'Vitamin C + Zinc' }]
    expect(findDuplicate({ name: 'vitamin c zinc' }, existing)).toEqual(existing[0])
    expect(findDuplicate({ name: 'Omega 3' }, existing)).toBeNull()
  })
})

describe('slugify / uniqueSlug', () => {
  it('builds product ids', () => {
    expect(slugify('Vitamin C + Zinc (1000mg)!')).toBe('vitamin-c-zinc-1000mg')
    expect(slugify('***')).toBe('product')
    expect(slugify('a'.repeat(80))).toHaveLength(50)
  })

  it('adds a numeric suffix on collision', () => {
    expect(uniqueSlug('zinc', new Set())).toBe('zinc')
    expect(uniqueSlug('zinc', new Set(['zinc']))).toBe('zinc-2')
    expect(uniqueSlug('zinc', new Set(['zinc', 'zinc-2']))).toBe('zinc-3')
  })
})

describe('hardening', () => {
  const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

  it('slugify always yields a valid id for hostile names', () => {
    for (const name of ['日本語', 'Café Crème', '%_%', 'a'.repeat(500), 'x-'.repeat(100), null, undefined, 42, {}, ['a'], '\u0000\n', '--a--b--']) {
      const slug = slugify(name)
      expect(slug).toMatch(ID)
      expect(slug.length).toBeLessThanOrEqual(50)
    }
    expect(slugify('日本語')).toBe('product')
    expect(slugify('Café Crème')).toBe('caf-cr-me')
  })

  it('suffixed slugs stay within 60 characters', () => {
    const base = slugify('a'.repeat(80))
    const taken = new Set([base])
    for (let n = 2; n < 1000; n += 1) taken.add(`${base}-${n}`)
    const id = uniqueSlug(base, taken)
    expect(id).toBe(`${base}-1000`)
    expect(id.length).toBeLessThanOrEqual(60)
  })

  it('matching helpers tolerate junk input', () => {
    expect(suggestCategory({ source_category: 5, name: {} }, categories)).toBe('')
    expect(suggestCategory({}, [{ name: null }, {}])).toBe('')
    expect(suggestCategory({ name: 'first aid' }, [])).toBe('')
    expect(findDuplicate({ name: 7 }, [{ name: null }, {}])).toBeNull()
    expect(findDuplicate({ name: '!!!' }, [{ name: '???' }])).toBeNull()
  })
})
