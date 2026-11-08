import { describe, expect, it, vi } from 'vitest'
import fixture from './fixtures/overpass-way.json'
import {
  OsmHttpError,
  OsmNotFoundError,
  OsmParseError,
  OsmRateLimitedError,
  OsmTimeoutError,
} from '../src/osm/errors'
import { DEFAULT_OVERPASS_ENDPOINT, fetchWay, overpassWayQuery } from '../src/osm/fetch'
import { parseOverpassJson } from '../src/osm/parse'
import { decodeTileFeatureId } from '../src/osm/tile-id'

describe('decodeTileFeatureId', () => {
  it('decodes ways, nodes and relations', () => {
    expect(decodeTileFeatureId(79960192)).toEqual({ kind: 'element', type: 'way', id: '7996019' })
    expect(decodeTileFeatureId(832273)).toEqual({ kind: 'element', type: 'relation', id: '83227' })
    expect(decodeTileFeatureId(1234561)).toEqual({ kind: 'element', type: 'node', id: '123456' })
  })
  it('flags merged features', () => {
    expect(decodeTileFeatureId(593120410)).toEqual({ kind: 'merged', hintWayId: '59312041' })
  })
  it('handles large IDs exactly', () => {
    expect(decodeTileFeatureId(122444269561)).toEqual({ kind: 'element', type: 'node', id: '12244426956' })
    expect(decodeTileFeatureId('99999999999999992')).toEqual({ kind: 'element', type: 'way', id: '9999999999999999' })
  })
  it('rejects garbage', () => {
    for (const v of [undefined, null, '', 'abc', 7, 15, -12, 1.5]) {
      expect(decodeTileFeatureId(v as never).kind).toBe('invalid')
    }
  })
})

describe('parseOverpassJson', () => {
  it('extracts tags, geometry, bounds and timestamp', () => {
    const way = parseOverpassJson(fixture, '123456789')
    expect(way).toEqual({
      type: 'way',
      id: '123456789',
      tags: { highway: 'primary', oneway: 'yes', lanes: '2', 'turn:lanes': 'left|through' },
      geometry: [
        { lat: 52.0, lon: 9.0 },
        { lat: 52.001, lon: 9.002 },
      ],
      bounds: { minlat: 52.0, minlon: 9.0, maxlat: 52.001, maxlon: 9.002 },
      dataTimestamp: '2026-11-08T12:00:00Z',
    })
  })
  it('throws not found for missing or deleted ways', () => {
    expect(() => parseOverpassJson({ elements: [] }, 1)).toThrow(OsmNotFoundError)
    expect(() => parseOverpassJson({ elements: [{ type: 'way', id: 1, visible: false }] }, 1)).toThrow(OsmNotFoundError)
    expect(() => parseOverpassJson({ elements: [{ type: 'node', id: 1 }] }, 1)).toThrow(OsmNotFoundError)
  })
  it('throws on non-OSM documents', () => {
    expect(() => parseOverpassJson('nope', 1)).toThrow(OsmParseError)
  })
})

const response = (status: number, body = '') => new Response(body, { status })

describe('fetchWay', () => {
  it('POSTs the Overpass query and parses the answer', async () => {
    const fetch = vi.fn(async () => response(200, JSON.stringify(fixture)))
    const way = await fetchWay(123456789, { fetch })
    expect(way.tags.lanes).toBe('2')
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(DEFAULT_OVERPASS_ENDPOINT)
    expect(init.method).toBe('POST')
    expect(new URLSearchParams(init.body as string).get('data')).toBe(overpassWayQuery('123456789'))
  })

  it('uses a custom endpoint and headers', async () => {
    const fetch = vi.fn(async () => response(200, JSON.stringify(fixture)))
    await fetchWay('123456789', { fetch, endpoint: 'https://example.test/api', headers: { 'User-Agent': 'x/1' } })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://example.test/api')
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('x/1')
  })

  it('retries with backoff on 429/5xx and then succeeds', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(504))
      .mockResolvedValueOnce(response(200, JSON.stringify(fixture)))
    const way = await fetchWay(123456789, { fetch, backoffMs: 1 })
    expect(way.id).toBe('123456789')
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('gives up with OsmRateLimitedError', async () => {
    const fetch = vi.fn(async () => response(502))
    await expect(fetchWay(1, { fetch, retries: 1, backoffMs: 1 })).rejects.toBeInstanceOf(OsmRateLimitedError)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('maps other statuses', async () => {
    await expect(fetchWay(1, { fetch: async () => response(400, 'bad query') })).rejects.toBeInstanceOf(OsmHttpError)
    await expect(fetchWay(1, { fetch: async () => response(200, '<html>') })).rejects.toBeInstanceOf(OsmParseError)
    await expect(fetchWay(5, { fetch: async () => response(200, '{"elements":[]}') })).rejects.toBeInstanceOf(OsmNotFoundError)
  })

  it('rejects invalid IDs before any request', async () => {
    const fetch = vi.fn()
    for (const id of ['0', '-1', 'abc', '1;out', '12 34']) {
      await expect(fetchWay(id, { fetch })).rejects.toBeInstanceOf(RangeError)
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports timeouts as OsmTimeoutError', async () => {
    const fetch = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason))),
    )
    await expect(fetchWay(1, { fetch: fetch as never, timeoutMs: 5 })).rejects.toBeInstanceOf(OsmTimeoutError)
  })

  it('honours an abort signal', async () => {
    const controller = new AbortController()
    const fetch = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
    )
    const p = fetchWay(1, { fetch: fetch as never, signal: controller.signal })
    controller.abort()
    await expect(p).rejects.toThrow(/Abort/)
  })
})
