export function formatPrice(amount) {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0
  return `₦${value.toLocaleString('en-NG')}`
}
