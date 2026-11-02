import { describe, expect, it } from 'vitest'
import { assertPublicUrl, isPrivateAddress } from '../../lib/import/urlSafety.js'
import { publicLookup } from '../helpers/fakeFetch.js'

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1',
  ])('blocks %s', (address) => expect(isPrivateAddress(address)).toBe(true))

  it.each(['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:2800:220:1:248:1893:25c8:1946'])(
    'allows %s',
    (address) => expect(isPrivateAddress(address)).toBe(false),
  )
})

describe('assertPublicUrl', () => {
  it('accepts a public https address', async () => {
    const url = await assertPublicUrl('https://shop.example/products', { lookup: publicLookup })
    expect(url.hostname).toBe('shop.example')
  })

  it('rejects other protocols', async () => {
    await expect(assertPublicUrl('ftp://shop.example/file', { lookup: publicLookup })).rejects.toThrow(/http/)
  })

  it('rejects text that is not a URL', async () => {
    await expect(assertPublicUrl('not a url', { lookup: publicLookup })).rejects.toThrow(/full website address/)
  })

  it('rejects embedded credentials', async () => {
    await expect(assertPublicUrl('https://user:pass@shop.example/', { lookup: publicLookup })).rejects.toThrow(/username/)
  })

  it('rejects localhost names and literal private IPs', async () => {
    await expect(assertPublicUrl('http://localhost:3000/', { lookup: publicLookup })).rejects.toThrow(/private network/)
    await expect(assertPublicUrl('http://127.0.0.1/admin', { lookup: publicLookup })).rejects.toThrow(/private network/)
  })

  it('rejects hostnames that resolve to private addresses', async () => {
    const lookup = async () => [{ address: '10.0.0.5' }]
    await expect(assertPublicUrl('https://sneaky.example/', { lookup })).rejects.toThrow(/private network/)
  })

  it('reports hosts that cannot be resolved', async () => {
    const lookup = async () => { throw new Error('ENOTFOUND') }
    await expect(assertPublicUrl('https://nowhere.example/', { lookup })).rejects.toThrow(/could not be found/)
  })
})
