import { assertPublicUrl, ImportError } from './urlSafety.js'

const MAX_REDIRECTS = 3
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024

async function readLimited(response, maxBytes) {
  const chunks = []
  let total = 0
  for await (const chunk of response.body ?? []) {
    total += chunk.length
    if (total > maxBytes) throw new ImportError('The page is too large to scan.', 502)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export async function safeFetch(rawUrl, {
  fetchImpl = fetch,
  lookup,
  timeoutMs = 8000,
  maxBytes = DEFAULT_MAX_BYTES,
  accept = '*/*',
} = {}) {
  let current = rawUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current, { lookup })
    let response
    try {
      response = await fetchImpl(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': 'VitalightImporter/1.0 (admin product import)', Accept: accept },
      })
    } catch {
      throw new ImportError('The website did not respond in time.', 502)
    }
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, url).toString()
      continue
    }
    if ([401, 403, 429].includes(response.status)) {
      throw new ImportError('The website refused the request (it may block automated access).', 502)
    }
    if (!response.ok) throw new ImportError(`The website answered with status ${response.status}.`, 502)
    if (Number(response.headers.get('content-length')) > maxBytes) {
      throw new ImportError('The page is too large to scan.', 502)
    }
    const body = await readLimited(response, maxBytes)
    return { url: url.toString(), contentType: response.headers.get('content-type') || '', body }
  }
  throw new ImportError('The website redirected too many times.', 502)
}

export async function fetchText(url, options) {
  const result = await safeFetch(url, options)
  return { url: result.url, text: result.body.toString('utf8'), contentType: result.contentType }
}

// Resolves to the parsed JSON, or null when the response is not JSON.
export async function fetchJson(url, options) {
  const { text } = await fetchText(url, { ...options, accept: 'application/json' })
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
