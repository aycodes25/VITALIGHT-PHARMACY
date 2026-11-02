import { describe, expect, it } from 'vitest'
import { fetchJson, fetchText, safeFetch } from '../../lib/import/safeFetch.js'
import { fakeFetch, publicLookup } from '../helpers/fakeFetch.js'

const opts = (routes) => {
  const { fetchImpl, calls } = fakeFetch(routes)
  return { fetchImpl, lookup: publicLookup, calls }
}

describe('safeFetch', () => {
  it('returns the body and final url', async () => {
    const o = opts({ 'https://shop.example/a': '<html>hi</html>' })
    const result = await safeFetch('https://shop.example/a', o)
    expect(result.url).toBe('https://shop.example/a')
    expect(result.body.toString()).toBe('<html>hi</html>')
  })

  it('re-checks every redirect hop and refuses private targets', async () => {
    const calls = []
    const fetchImpl = async (input) => {
      calls.push(String(input))
      return String(input).startsWith('https://a.example')
        ? new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } })
        : new Response('secret')
    }
    await expect(safeFetch('https://a.example/x', { fetchImpl, lookup: publicLookup })).rejects.toThrow(/private network/)
    expect(calls).toEqual(['https://a.example/x'])
  })

  it('follows a safe redirect', async () => {
    const fetchImpl = async (input) => (String(input) === 'https://a.example/old'
      ? new Response(null, { status: 301, headers: { location: '/new' } })
      : new Response('moved'))
    const result = await safeFetch('https://a.example/old', { fetchImpl, lookup: publicLookup })
    expect(result.url).toBe('https://a.example/new')
    expect(result.body.toString()).toBe('moved')
  })

  it('stops after too many redirects', async () => {
    const fetchImpl = async () => new Response(null, { status: 302, headers: { location: '/again' } })
    await expect(safeFetch('https://a.example/x', { fetchImpl, lookup: publicLookup })).rejects.toThrow(/redirected too many times/)
  })

  it('refuses oversized responses', async () => {
    const o = opts({ 'https://shop.example/big': 'x'.repeat(100) })
    await expect(safeFetch('https://shop.example/big', { ...o, maxBytes: 10 })).rejects.toThrow(/too large/)
  })

  it('explains blocked and missing pages', async () => {
    const fetchImpl = async (input) => (String(input).endsWith('/blocked')
      ? new Response('no', { status: 403 })
      : new Response('no', { status: 404 }))
    await expect(safeFetch('https://a.example/blocked', { fetchImpl, lookup: publicLookup })).rejects.toThrow(/refused/)
    await expect(safeFetch('https://a.example/missing', { fetchImpl, lookup: publicLookup })).rejects.toThrow(/status 404/)
  })

  it('maps network failures to a friendly error', async () => {
    const fetchImpl = async () => { throw new Error('socket hang up') }
    await expect(safeFetch('https://a.example/x', { fetchImpl, lookup: publicLookup })).rejects.toThrow(/did not respond/)
  })

  it('maps body-read failures to a friendly error', async () => {
    const fetchImpl = async () => new Response(new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('ab'))
        c.error(new Error('socket reset'))
      },
    }))
    await expect(safeFetch('https://a.example/x', { fetchImpl, lookup: publicLookup })).rejects.toThrow(/did not respond/)
  })

  it('maps a malformed redirect location to a friendly error', async () => {
    const fetchImpl = async () => new Response(null, { status: 302, headers: { location: 'http://' } })
    await expect(safeFetch('https://a.example/x', { fetchImpl, lookup: publicLookup })).rejects.toThrow(/invalid redirect/)
  })
})

describe('fetchText / fetchJson', () => {
  it('decodes text and parses json, returning null for invalid json', async () => {
    const o = opts({
      'https://shop.example/page': '<p>é</p>',
      'https://shop.example/data.json': { ok: true },
      'https://shop.example/not-json': '<html></html>',
    })
    expect((await fetchText('https://shop.example/page', o)).text).toBe('<p>é</p>')
    expect(await fetchJson('https://shop.example/data.json', o)).toEqual({ ok: true })
    expect(await fetchJson('https://shop.example/not-json', o)).toBeNull()
  })
})
