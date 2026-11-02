// Parses a price written in major currency units ("₦8,500.00", "1.234,50", 8500) into a whole number.
// Returns null when no sensible non-negative number can be read.
export function parsePrice(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value) : null
  const raw = String(value).trim()
  if (raw.startsWith('-')) return null
  const runs = raw.split(/[^\d.,]+/).filter(Boolean)
  if (runs.length !== 1 || !/\d/.test(runs[0])) return null
  const text = runs[0]

  let normalized
  if (!text.includes(',') && /^\d{1,3}(\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, '') // "8.500" is a thousands separator
  } else if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
    normalized = /,\d{1,2}$/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else {
    normalized = text.replace(/,/g, '')
  }
  const number = Number(normalized)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null
}
