import { describe, expect, it, vi } from 'vitest'
import { OsmHttpError, OsmNotFoundError } from '../src/osm/errors'
import { fetchWaysInBbox, osmApiMapUrl } from '../src/osm/fetch'
import { bboxAround, distanceToWay } from '../src/osm/geometry'
import { parseOsmApiWays } from '../src/osm/parse'
import { isStreet } from '../src/osm/street'

const mapDoc = {
  elements: [
    { type: 'node', id: 1, lat: 52.0, lon: 9.0 },
    { type: 'node', id: 2, lat: 52.0, lon: 9.001 },
    { type: 'node', id: 3, lat: 52.001, lon: 9.001 },
    { type: 'way', id: 10, nodes: [1, 2], tags: { highway: 'residential', name: 'A' }, version: 3 },
    { type: 'way', id: 11, nodes: [2, 3], tags: { highway: 'footway' } },
    { type: 'way', id: 12, nodes: [1, 3], visible: false },
    { type: 'relation', id: 10, members: [] },
  ],
}

const response = (status: number, body = '') => new Response(body, { status })

describe('parseOsmApiWays', () => {
  it('returns every visible way with geometry, in document order', () => {
    const ways = parseOsmApiWays(mapDoc)
    expect(ways.map((w) => w.id)).toEqual(['10', '11'])
    expect(ways[0]).toMatchObject({ tags: { highway: 'residential', name: 'A' }, version: 3, source: 'osm-api' })
    expect(ways[1]!.geometry).toEqual([
      { lat: 52.0, lon: 9.001 },
      { lat: 52.001, lon: 9.001 },
    ])
  })
})

describe('fetchWaysInBbox', () => {
  const box = { minlat: 52.0, minlon: 9.0, maxlat: 52.0003, maxlon: 9.0005 }
  it('GETs /api/0.6/map.json with lon/lat order', async () => {
    const fetch = vi.fn(async () => response(200, JSON.stringify(mapDoc)))
    const ways = await fetchWaysInBbox(box, { fetch, baseUrl: 'https://osm.example.test/' })
    expect(ways).toHaveLength(2)
    const [url] = fetch.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://osm.example.test/api/0.6/map.json?bbox=9,52,9.0005,52.0003')
    expect(osmApiMapUrl(box)).toBe('https://api.openstreetmap.org/api/0.6/map.json?bbox=9,52,9.0005,52.0003')
  })
  it('rejects invalid and oversized boxes before any request', async () => {
    const fetch = vi.fn()
    await expect(fetchWaysInBbox({ ...box, maxlat: 51 }, { fetch })).rejects.toBeInstanceOf(RangeError)
    await expect(fetchWaysInBbox({ ...box, minlon: Number.NaN }, { fetch })).rejects.toBeInstanceOf(RangeError)
    await expect(fetchWaysInBbox({ minlat: 52, minlon: 9, maxlat: 52.01, maxlon: 9.01 }, { fetch })).rejects.toBeInstanceOf(RangeError)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('reports 400/404 as HTTP errors, not as a missing way', async () => {
    const err = await fetchWaysInBbox(box, { fetch: async () => response(400, 'too many nodes') }).catch((e) => e)
    expect(err).toBeInstanceOf(OsmHttpError)
    const err404 = await fetchWaysInBbox(box, { fetch: async () => response(404) }).catch((e) => e)
    expect(err404).toBeInstanceOf(OsmHttpError)
    expect(err404).not.toBeInstanceOf(OsmNotFoundError)
  })
})

describe('geometry', () => {
  const p = { lat: 52, lon: 9 }
  it('builds a box of the given half-size', () => {
    const b = bboxAround(p, 100)
    expect(distanceToWay(p, [{ lat: b.maxlat, lon: 9 }])).toBeCloseTo(100, 0)
    expect(distanceToWay(p, [{ lat: 52, lon: b.maxlon }])).toBeCloseTo(100, 0)
  })
  it('measures the distance to the line, not just to its nodes', () => {
    const b = bboxAround(p, 20)
    // a segment passing 20 m north of the point, with both nodes 1 km away
    const line = [
      { lat: b.maxlat, lon: 8.985 },
      { lat: b.maxlat, lon: 9.015 },
    ]
    expect(distanceToWay(p, line)).toBeCloseTo(20, 0)
    // beyond a segment's end the nearest node counts
    expect(distanceToWay(p, [{ lat: 52.001, lon: 9.001 }, { lat: 52.002, lon: 9.002 }])).toBeGreaterThan(130)
    expect(distanceToWay(p, [])).toBe(Infinity)
    expect(distanceToWay(p, undefined)).toBe(Infinity)
  })
})

describe('isStreet', () => {
  it('accepts streets and streets under construction', () => {
    for (const highway of ['primary', 'trunk_link', 'residential', 'living_street', 'service', 'busway', 'unclassified']) {
      expect(isStreet({ highway })).toBe(true)
    }
    expect(isStreet({ highway: 'construction', construction: 'secondary' })).toBe(true)
  })
  it('rejects paths, cycleways, pedestrian areas, tracks and non-highways', () => {
    for (const highway of ['footway', 'cycleway', 'path', 'pedestrian', 'steps', 'bridleway', 'track', 'platform', 'proposed']) {
      expect(isStreet({ highway })).toBe(false)
    }
    expect(isStreet({ highway: 'construction', construction: 'cycleway' })).toBe(false)
    expect(isStreet({ railway: 'rail' })).toBe(false)
  })
})
