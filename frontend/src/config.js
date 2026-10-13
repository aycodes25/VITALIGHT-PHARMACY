import { normalizeWhatsAppNumber } from '../../shared/whatsapp.js'

const env = import.meta.env

// Vitalight customer care (08105079027). VITE_PHARMACY_WHATSAPP overrides it.
const DEFAULT_WHATSAPP = '2348105079027'

export const contact = {
  phone: env.VITE_PHARMACY_PHONE || '',
  whatsapp: normalizeWhatsAppNumber(env.VITE_PHARMACY_WHATSAPP) || DEFAULT_WHATSAPP,
  email: env.VITE_PHARMACY_EMAIL || '',
}
