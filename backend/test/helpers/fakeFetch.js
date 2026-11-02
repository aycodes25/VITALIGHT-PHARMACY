export const publicLookup = async () => [{ address: '93.184.216.34' }]

// routes: { [absoluteUrl]: string (html) | Buffer (png) | object (json) }; anything else answers 404.
export function fakeFetch(routes = {}) {
  const calls = []
  async function fetchImpl(input) {
    const key = String(input)
    calls.push(key)
    const hit = routes[key]
    if (hit === undefined) return new Response('Not found', { status: 404 })
    if (Buffer.isBuffer(hit)) return new Response(hit, { status: 200, headers: { 'content-type': 'image/png' } })
    if (typeof hit === 'string') return new Response(hit, { status: 200, headers: { 'content-type': 'text/html' } })
    return new Response(JSON.stringify(hit), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return { fetchImpl, calls }
}

export const PNG_BYTES = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
