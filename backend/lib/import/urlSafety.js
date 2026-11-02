import net from 'node:net'
import { lookup as dnsLookup } from 'node:dns/promises'

export class ImportError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ImportError'
    this.status = status
  }
}

export function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return a === 0 || a === 10 || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127)
      || a >= 224
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase()
    if (lower === '::' || lower === '::1' || lower.startsWith('::ffff:')) return true
    return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)
  }
  return true
}

// Validates a user-supplied address and resolves it. The DNS answer is checked here, so a name that points at a
// private network is refused. (A DNS answer that changes between this check and the request is not covered; the
// endpoints that use this are admin-only.)
export async function assertPublicUrl(rawUrl, { lookup = dnsLookup } = {}) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw new ImportError('Enter a full website address starting with https://')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ImportError('Only http and https addresses can be scanned.')
  }
  if (url.username || url.password) {
    throw new ImportError('Addresses with a username or password are not allowed.')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const privateName = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')
  if (privateName) throw new ImportError('That address points to a private network and cannot be scanned.')

  let addresses
  if (net.isIP(host)) {
    addresses = [{ address: host }]
  } else {
    try {
      addresses = await lookup(host, { all: true })
    } catch {
      throw new ImportError('That website address could not be found.')
    }
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ImportError('That address points to a private network and cannot be scanned.')
  }
  return url
}
