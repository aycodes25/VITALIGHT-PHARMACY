// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import HeroVisual from './HeroVisual.jsx'

let instances
class FakeImage {
  constructor() { instances.push(this) }
  set src(value) { this._src = value }
  get src() { return this._src }
}

beforeEach(() => {
  instances = []
  vi.stubGlobal('Image', FakeImage)
})
afterEach(() => vi.unstubAllGlobals())

describe('HeroVisual', () => {
  it('shows the illustrations until a photo loads', () => {
    const { container } = render(<HeroVisual />)
    expect(container.querySelector('.hero-art')).not.toBeNull()
    expect(container.querySelector('.hero-photo')).toBeNull()
    expect(instances[0].src).toBe('/hero.jpg')
  })

  it('switches to the photo when the file loads', () => {
    const { container } = render(<HeroVisual />)
    act(() => instances[0].onload())
    expect(container.querySelector('.hero-photo img').getAttribute('src')).toBe('/hero.jpg')
    expect(container.querySelector('.hero-art')).toBeNull()
  })

  it('keeps the illustrations when the photo is missing or not an image', () => {
    const { container } = render(<HeroVisual />)
    act(() => instances[0].onerror())
    expect(container.querySelector('.hero-art')).not.toBeNull()
  })
})
