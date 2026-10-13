// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import ProductArt from './ProductArt.jsx'
import { ART_KEYS } from '../artKeys.js'

describe('ProductArt', () => {
  it('renders an svg for every art key', () => {
    for (const key of ART_KEYS) {
      const { container, unmount } = render(<ProductArt type={key} name={key} />)
      expect(container.querySelector('svg'), key).not.toBeNull()
      expect(container.querySelectorAll('svg *').length, key).toBeGreaterThan(2)
      unmount()
    }
  })
  it('falls back to the bottle for unknown types', () => {
    const { container } = render(<ProductArt type="unicorn" name="x" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
  it('prefers an uploaded photo over artwork', () => {
    const { container } = render(<ProductArt type="vitamin" imageUrl="https://example.com/a.png" name="Photo" />)
    expect(container.querySelector('img').getAttribute('src')).toBe('https://example.com/a.png')
    expect(container.querySelector('svg')).toBeNull()
  })
  it('exposes the product name as the accessible label', () => {
    const { getByRole } = render(<ProductArt type="tube" name="Sunscreen" />)
    expect(getByRole('img').getAttribute('aria-label')).toBe('Sunscreen')
  })
})
