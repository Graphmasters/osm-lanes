import { OsmNotFoundError, OsmParseError } from './errors'
import type { LatLon, OsmElementType, OsmWay } from './types'

interface RawElement {
  type?: unknown
  id?: unknown
  tags?: unknown
  geometry?: unknown
  bounds?: unknown
  visible?: unknown
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Finds an element by type and ID; IDs are only unique within one element type. */
export function pick(elements: readonly RawElement[], type: OsmElementType, id: string) {
  return elements.find((e) => e.type === type && String(e.id) === id)
}

function parseTags(raw: unknown): Record<string, string> {
  const tags: Record<string, string> = {}
  if (!isObject(raw)) return tags
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') tags[k] = v
  }
  return tags
}

function parseGeometry(raw: unknown): LatLon[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: LatLon[] = []
  for (const p of raw) {
    // Overpass emits `null` for nodes outside a bbox clip; skip them.
    if (isObject(p) && typeof p.lat === 'number' && typeof p.lon === 'number') {
      out.push({ lat: p.lat, lon: p.lon })
    }
  }
  return out.length ? out : undefined
}

function parseBounds(raw: unknown): OsmWay['bounds'] {
  if (!isObject(raw)) return undefined
  const { minlat, minlon, maxlat, maxlon } = raw
  if ([minlat, minlon, maxlat, maxlon].every((n) => typeof n === 'number')) {
    return { minlat, minlon, maxlat, maxlon } as NonNullable<OsmWay['bounds']>
  }
  return undefined
}

/**
 * Parses an OSM JSON document (`{ elements: [...] }`) as returned by Overpass
 * (`out tags geom`) and extracts one way.
 *
 * @throws OsmNotFoundError when the way is absent or deleted (`visible: false`)
 * @throws OsmParseError when the document is not OSM JSON
 */
export function parseOverpassJson(json: unknown, wayId: string | number): OsmWay {
  const id = String(wayId)
  if (!isObject(json) || !Array.isArray(json.elements)) {
    throw new OsmParseError('Response is not an OSM JSON document')
  }
  const el = pick(json.elements as RawElement[], 'way', id)
  if (!el || el.visible === false) throw new OsmNotFoundError('way', id)

  const way: OsmWay = { type: 'way', id, tags: parseTags(el.tags), source: 'overpass' }
  const geometry = parseGeometry(el.geometry)
  if (geometry) way.geometry = geometry
  const bounds = parseBounds(el.bounds)
  if (bounds) way.bounds = bounds
  const osm3s = json.osm3s
  if (isObject(osm3s) && typeof osm3s.timestamp_osm_base === 'string') {
    way.dataTimestamp = osm3s.timestamp_osm_base
  }
  return way
}

/**
 * Parses the OSM API v0.6 answer for `/api/0.6/way/{id}/full.json` (the way plus all its nodes)
 * and extracts one way. The geometry is rebuilt from the referenced nodes in way order.
 *
 * @throws OsmNotFoundError when the way is absent or deleted (`visible: false`)
 * @throws OsmParseError when the document is not OSM JSON
 */
export function parseOsmApiJson(json: unknown, wayId: string | number): OsmWay {
  const id = String(wayId)
  const elements = osmElements(json)
  const el = pick(elements, 'way', id) as ApiElement | undefined
  if (!el || el.visible === false) throw new OsmNotFoundError('way', id)
  return osmApiWay(el, nodeIndex(elements))
}

/**
 * Parses an OSM API v0.6 document holding several ways and their nodes (e.g. `/api/0.6/map`)
 * and returns every visible way, with geometry rebuilt from the nodes, in document order.
 *
 * @throws OsmParseError when the document is not OSM JSON
 */
export function parseOsmApiWays(json: unknown): OsmWay[] {
  const elements = osmElements(json)
  const nodes = nodeIndex(elements)
  return elements.filter((e) => e.type === 'way' && e.visible !== false && e.id !== undefined).map((e) => osmApiWay(e, nodes))
}

type ApiElement = RawElement & Record<string, unknown>

function osmElements(json: unknown): ApiElement[] {
  if (!isObject(json) || !Array.isArray(json.elements)) {
    throw new OsmParseError('Response is not an OSM JSON document')
  }
  return json.elements as ApiElement[]
}

function nodeIndex(elements: readonly ApiElement[]): Map<string, LatLon> {
  const nodes = new Map<string, LatLon>()
  for (const e of elements) {
    if (e.type === 'node' && typeof e.lat === 'number' && typeof e.lon === 'number') {
      nodes.set(String(e.id), { lat: e.lat, lon: e.lon })
    }
  }
  return nodes
}

function osmApiWay(el: ApiElement, nodes: Map<string, LatLon>): OsmWay {
  const geometry: LatLon[] = []
  if (Array.isArray(el.nodes)) {
    for (const ref of el.nodes) {
      const p = nodes.get(String(ref))
      if (p) geometry.push(p)
    }
  }
  const way: OsmWay = { type: 'way', id: String(el.id), tags: parseTags(el.tags), source: 'osm-api' }
  if (geometry.length) {
    way.geometry = geometry
    way.bounds = {
      minlat: Math.min(...geometry.map((p) => p.lat)),
      minlon: Math.min(...geometry.map((p) => p.lon)),
      maxlat: Math.max(...geometry.map((p) => p.lat)),
      maxlon: Math.max(...geometry.map((p) => p.lon)),
    }
  }
  if (typeof el.timestamp === 'string') way.timestamp = el.timestamp
  if (typeof el.version === 'number') way.version = el.version
  return way
}
