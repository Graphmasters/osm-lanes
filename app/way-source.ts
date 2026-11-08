// Way loading for the demo. The OSM API v0.6 answers single-way lookups in well under a second,
// so it is tried first; Overpass (FOSSGIS) is the fallback when the API is busy or unreachable.
// Usage policies:
//   OSM API:  https://operations.osmfoundation.org/policies/api/
//   Overpass: https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/
// Both ask for low volumes: one request at a time, results cached for the session, and nothing
// is requested without an explicit click or deep link.

import {
  DEFAULT_OSM_API_BASE_URL,
  DEFAULT_OVERPASS_ENDPOINT,
  fetchWay,
  fetchWayFromOsmApi,
  OsmNotFoundError,
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
