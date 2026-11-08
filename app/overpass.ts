// Overpass access for the demo: one request at a time, results cached for the session, and
// nothing is requested without an explicit click or deep link (FOSSGIS usage terms:
// https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/).

import { DEFAULT_OVERPASS_ENDPOINT, fetchWay, type OsmWay } from '../src/index'

const endpoint = (import.meta.env.VITE_OVERPASS_ENDPOINT as string | undefined) || DEFAULT_OVERPASS_ENDPOINT
const cache = new Map<string, OsmWay>()
let inFlight: AbortController | null = null

export function cancelPending() {
  inFlight?.abort(new DOMException('Superseded', 'AbortError'))
  inFlight = null
}

export async function loadWay(id: string): Promise<OsmWay> {
  const hit = cache.get(id)
  if (hit) return hit
  cancelPending()
  const controller = new AbortController()
  inFlight = controller
  try {
    const way = await fetchWay(id, { endpoint, signal: controller.signal, retries: 2, backoffMs: 1500 })
    cache.set(id, way)
    return way
  } finally {
    if (inFlight === controller) inFlight = null
  }
}

export const OVERPASS_ENDPOINT = endpoint
