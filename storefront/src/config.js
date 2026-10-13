const env = import.meta.env

export const contact = {
  phone: env.VITE_PHARMACY_PHONE || '',
  whatsapp: (env.VITE_PHARMACY_WHATSAPP || '').replace(/[^\d]/g, ''),
  email: env.VITE_PHARMACY_EMAIL || '',
}
