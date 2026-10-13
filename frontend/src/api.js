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

export async function submitOrder(payload, token) {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await readError(response, 'We could not submit your request.'))
  return response.json()
}

function authHeaders(token, extra = {}) {
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

export async function fetchProfile(token) {
  const response = await fetch('/api/account/profile', { headers: authHeaders(token) })
  if (!response.ok) throw new Error(await readError(response, 'We could not load your account.'))
  return response.json()
}

export async function saveProfile(token, changes) {
  const response = await fetch('/api/account/profile', {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(changes),
  })
  if (!response.ok) throw new Error(await readError(response, 'We could not save your changes.'))
  return response.json()
}

export async function fetchMyOrders(token) {
  const response = await fetch('/api/account/orders', { headers: authHeaders(token) })
  if (!response.ok) throw new Error(await readError(response, 'We could not load your orders.'))
  return response.json()
}
