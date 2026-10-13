// Builds a CSV telling the owner which filename each product photo needs.
const csvCell = (value) => {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildChecklistCsv(products) {
  const header = ['filename', 'product_id', 'name', 'brand', 'category', 'has_photo']
  const rows = products.map((p) => [
    `${p.id}.jpg`,
    p.id,
    p.name,
    p.brand ?? '',
    p.category ?? '',
    p.image_url || (Array.isArray(p.images) && p.images.length) ? 'yes' : 'NO',
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
}
