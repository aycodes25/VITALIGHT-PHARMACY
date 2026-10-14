// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

async function load(whatsapp) {
  vi.resetModules()
  vi.doMock('../config.js', () => ({ contact: { phone: '', whatsapp, email: '' } }))
  return (await import('./WhatsAppButton.jsx')).default
}

afterEach(() => vi.doUnmock('../config.js'))

describe('WhatsAppButton', () => {
  it('links to customer care with a greeting', async () => {
    const Button = await load('2349033925476')
    render(<Button />)
    const link = screen.getByLabelText('Chat with Vitalight customer care on WhatsApp')
    expect(link.getAttribute('href')).toBe(`https://wa.me/2349033925476?text=${encodeURIComponent('Hello Vitalight Pharmacy, I need some help.')}`)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })
  it('renders nothing without a number', async () => {
    const Button = await load('')
    const { container } = render(<Button />)
    expect(container.firstChild).toBeNull()
  })
})
