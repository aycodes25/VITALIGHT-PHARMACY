async function readError(response, fallback) {
  try {
    const body = await response.json()
    return body.error || fallback
  } catch {
    return fallback
  }
}

export async function fetchCatalog(signal) {
  const response = await fetch('/api/catalog', { signal })
  if (!response.ok) throw new Error(await readError(response, 'The live catalogue could not be loaded.'))
  return response.json()
}

export async function submitOrder(payload) {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await readError(response, 'We could not submit your request.'))
  return response.json()
}
