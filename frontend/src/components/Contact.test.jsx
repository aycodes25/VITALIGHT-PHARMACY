// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

async function load(contact) {
  vi.resetModules()
  vi.doMock('../config.js', () => ({ contact }))
  vi.doMock('../context/CatalogContext.jsx', () => ({ useCatalog: () => ({ categories: [] }) }))
  const Band = (await import('./PrescriptionBand.jsx')).default
  const Footer = (await import('./Footer.jsx')).default
  return { Band, Footer }
}

afterEach(() => {
  vi.doUnmock('../config.js')
  vi.doUnmock('../context/CatalogContext.jsx')
})

describe('contact details', () => {
  it('shows no email links and no action button when nothing is configured', async () => {
    const { Band, Footer } = await load({ phone: '', whatsapp: '', email: '' })
    const { container } = render(<MemoryRouter><Band /><Footer /></MemoryRouter>)
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(container.querySelector('.rx-actions a')).toBeNull()
    expect(screen.getByText('Have a prescription?')).toBeTruthy()
  })
  it('shows only configured contact methods', async () => {
    const { Band, Footer } = await load({ phone: '+2348000000000', whatsapp: '2348000000000', email: 'a@b.test' })
    const { container } = render(<MemoryRouter><Band /><Footer /></MemoryRouter>)
    expect(container.querySelector('a[href="tel:+2348000000000"]')).toBeTruthy()
    expect(container.querySelector('a[href="mailto:a@b.test"]')).toBeTruthy()
  })
  it('falls back to the email button in the band when only email is set', async () => {
    const { Band } = await load({ phone: '', whatsapp: '', email: 'a@b.test' })
    const { container } = render(<MemoryRouter><Band /></MemoryRouter>)
    expect(container.querySelector('.rx-actions a[href="mailto:a@b.test"]')).toBeTruthy()
  })
})
