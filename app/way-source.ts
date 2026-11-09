// Way loading for the demo. The OSM API v0.6 answers single-way lookups in well under a second,
// so it is tried first; Overpass (FOSSGIS) is the fallback when the API is busy or unreachable.
// Usage policies:
//   OSM API:  https://operations.osmfoundation.org/policies/api/
//   Overpass: https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/
// Both ask for low volumes: one request at a time, results cached for the session, and nothing
// is requested without an explicit click or deep link.

import {
  bboxAround,
  DEFAULT_OSM_API_BASE_URL,
  DEFAULT_OVERPASS_ENDPOINT,
  distanceToWay,
  fetchWay,
  fetchWayFromOsmApi,
  fetchWaysInBbox,
  isStreet,
  OsmNotFoundError,
  type LatLon,
  type OsmWay,
} from '../src/index'

const env = import.meta.env as Record<string, string | undefined>
const osmApiBaseUrl = env.VITE_OSM_API_BASE_URL || DEFAULT_OSM_API_BASE_URL
const overpassEndpoint = env.VITE_OVERPASS_ENDPOINT || DEFAULT_OVERPASS_ENDPOINT

const cache = new Map<string, OsmWay>()
let inFlight: AbortController | null = null

export function cancelPending() {
  inFlight?.abort(new DOMException('Superseded', 'AbortError'))
  inFlight = null
}

const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError'

/** A way that is already loaded, without any request. */
export function cachedWay(id: string): OsmWay | undefined {
  return cache.get(id)
}

export async function loadWay(id: string): Promise<OsmWay> {
  const hit = cache.get(id)
  if (hit) return hit
  cancelPending()
  const controller = new AbortController()
  inFlight = controller
  const { signal } = controller
  try {
    let way: OsmWay
    try {
      way = await fetchWayFromOsmApi(id, { baseUrl: osmApiBaseUrl, signal, timeoutMs: 10_000, retries: 0 })
    } catch (err) {
      // A missing/deleted way is an answer, not a failure; asking Overpass would not change it.
      if (err instanceof OsmNotFoundError || isAbort(err) || signal.aborted) throw err
      way = await fetchWay(id, { endpoint: overpassEndpoint, signal, retries: 2, backoffMs: 1500 })
    }
    cache.set(id, way)
    return way
  } finally {
    if (inFlight === controller) inFlight = null
  }
}

/** A street near a clicked point, with its distance from the point. */
export interface WayCandidate {
  way: OsmWay
  distanceM: number
}

/**
 * Box sizes (half-size in metres) for finding the streets at a clicked point. The OSM API only
 * returns ways with a node inside the box, so a long straight segment can pass the point without
 * being found; if the small box has no street close by, one larger box is tried.
 */
const SEARCH_BOXES_M = [15, 60]
/** A street this close to the click is taken to be the clicked one. */
const NEAR_M = 10
/** Streets farther away are not offered (wide roads at low zoom are drawn ~20 m wide). */
const MAX_CANDIDATE_M = 25

/**
 * The streets at a point, nearest first — for map features that the vector tiles merged from
 * several ways and that therefore do not name the clicked way. One OSM API `/map` request (two if
 * nothing close is found). The ways are cached, so selecting one needs no further request.
 */
export async function findStreetsAt(point: LatLon): Promise<WayCandidate[]> {
  cancelPending()
  const controller = new AbortController()
  inFlight = controller
  const { signal } = controller
  try {
    let found: WayCandidate[] = []
    for (const half of SEARCH_BOXES_M) {
      const ways = await fetchWaysInBbox(bboxAround(point, half), { baseUrl: osmApiBaseUrl, signal, timeoutMs: 10_000, retries: 1 })
      found = ways
        .filter((w) => isStreet(w.tags) && w.geometry)
        .map((way) => ({ way, distanceM: distanceToWay(point, way.geometry) }))
        .filter((c) => c.distanceM <= MAX_CANDIDATE_M)
        .sort((a, b) => a.distanceM - b.distanceM)
      if (found[0] && found[0].distanceM <= NEAR_M) break
    }
    for (const c of found) cache.set(c.way.id, c.way)
    return found
  } finally {
    if (inFlight === controller) inFlight = null
  }
}
