import { formatPrice } from './money.js'

// Returns digits-only international form (e.g. 2348105079027), or '' when invalid.
export function normalizeWhatsAppNumber(input) {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length < 10) return ''
  if (digits.length === 11 && digits.startsWith('0')) return `234${digits.slice(1)}`
  return digits
}

export function whatsAppLink(number, text) {
  if (!number) return ''
  const base = `https://wa.me/${number}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function buildOrderMessage({ orderId, name, phone, address, lines = [], total, hasRx }) {
  const rows = ['New order request - Vitalight Pharmacy']
  if (orderId) rows.push(`Order: #${String(orderId).slice(0, 8).toUpperCase()}`)
  rows.push(`Name: ${name}`, `Phone: ${phone}`, `Address: ${address}`, 'Items:')
  for (const { product, quantity, lineTotal } of lines) {
    rows.push(`- ${quantity} x ${product.name} (${formatPrice(lineTotal)})`)
  }
  rows.push(`Estimated total: ${formatPrice(total)}`)
  if (hasRx) rows.push('Includes prescription medicines - please verify.')
  return rows.join('\n')
}
