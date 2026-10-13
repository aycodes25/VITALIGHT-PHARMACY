import { describe, expect, it } from 'vitest'
import { MAX_PHOTOS, buildFinalImages, moveToFirst, removeAt, validateNewFiles } from './imageList.js'

const file = (name, type = 'image/png', size = 1000) => ({ name, type, size })

describe('validateNewFiles', () => {
  it('accepts valid files', () => {
    const files = [file('a.png'), file('b.jpg', 'image/jpeg'), file('c.webp', 'image/webp')]
    expect(validateNewFiles(0, files)).toEqual({ ok: true, errors: [], accepted: files })
  })
  it('rejects wrong types and oversize files by name', () => {
    const result = validateNewFiles(0, [file('a.gif', 'image/gif'), file('big.png', 'image/png', 5 * 1024 * 1024 + 1), file('ok.png')])
    expect(result.ok).toBe(false)
    expect(result.accepted.map((f) => f.name)).toEqual(['ok.png'])
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toMatch(/a\.gif.*JPEG, PNG or WebP/)
    expect(result.errors[1]).toMatch(/big\.png.*5 MB/)
  })
  it('limits the total to 8 photos', () => {
    const files = [file('1.png'), file('2.png'), file('3.png')]
    const result = validateNewFiles(6, files)
    expect(result.ok).toBe(false)
    expect(result.accepted.map((f) => f.name)).toEqual(['1.png', '2.png'])
    expect(result.errors.join(' ')).toMatch(/up to 8/)
    expect(MAX_PHOTOS).toBe(8)
  })
})

describe('list helpers', () => {
  it('moveToFirst moves without mutating', () => {
    const list = ['a', 'b', 'c']
    expect(moveToFirst(list, 2)).toEqual(['c', 'a', 'b'])
    expect(list).toEqual(['a', 'b', 'c'])
    expect(moveToFirst(list, 0)).toEqual(['a', 'b', 'c'])
    expect(moveToFirst(list, 9)).toEqual(['a', 'b', 'c'])
  })
  it('removeAt removes without mutating', () => {
    const list = ['a', 'b', 'c']
    expect(removeAt(list, 1)).toEqual(['a', 'c'])
    expect(list).toEqual(['a', 'b', 'c'])
    expect(removeAt(list, -1)).toEqual(['a', 'b', 'c'])
  })
  it('buildFinalImages keeps existing then uploaded, deduped and capped', () => {
    expect(buildFinalImages(['a', 'b'], ['c', 'a', 'd'])).toEqual(['a', 'b', 'c', 'd'])
    expect(buildFinalImages(Array.from({ length: 7 }, (_, i) => `e${i}`), ['x', 'y', 'z'])).toHaveLength(8)
  })
})
