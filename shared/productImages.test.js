import { describe, expect, it } from 'vitest'
import { productImages } from './productImages.js'

describe('productImages', () => {
  it('returns the gallery in order', () => {
    expect(productImages({ images: ['a', 'b'], image_url: 'a' })).toEqual(['a', 'b'])
  })
  it('puts image_url first when missing from the gallery and dedupes', () => {
    expect(productImages({ images: ['b', 'c', 'b'], image_url: 'a' })).toEqual(['a', 'b', 'c'])
    expect(productImages({ images: ['b', 'a'], image_url: 'a' })).toEqual(['a', 'b'])
  })
  it('falls back to image_url, then to nothing', () => {
    expect(productImages({ images: [], image_url: 'a' })).toEqual(['a'])
    expect(productImages({ image_url: 'a' })).toEqual(['a'])
    expect(productImages({ images: null, image_url: null })).toEqual([])
    expect(productImages({})).toEqual([])
    expect(productImages(null)).toEqual([])
  })
})
