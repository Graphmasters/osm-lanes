// Small geometric helpers for picking ways near a point. A local flat projection around the
// point is accurate enough for the few hundred metres involved.

import type { BBox, LatLon } from './types'

const EARTH_RADIUS_M = 6_371_008.8
const M_PER_DEG_LAT = (Math.PI / 180) * EARTH_RADIUS_M

const mPerDegLon = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)

/** A square box of `halfSizeM` metres in each direction around a point. */
export function bboxAround(point: LatLon, halfSizeM: number): BBox {
  const dLat = halfSizeM / M_PER_DEG_LAT
  const dLon = halfSizeM / mPerDegLon(point.lat)
  return { minlat: point.lat - dLat, minlon: point.lon - dLon, maxlat: point.lat + dLat, maxlon: point.lon + dLon }
}

/**
 * Shortest distance in metres from a point to a way's line (not just its nodes), or `Infinity`
 * without geometry. A single-node geometry gives the distance to that node.
 */
export function distanceToWay(point: LatLon, geometry: readonly LatLon[] | undefined): number {
  if (!geometry?.length) return Infinity
  const kx = mPerDegLon(point.lat)
  const xy = (p: LatLon) => [(p.lon - point.lon) * kx, (p.lat - point.lat) * M_PER_DEG_LAT] as const
  let best = Infinity
  let [ax, ay] = xy(geometry[0]!)
  if (geometry.length === 1) return Math.hypot(ax, ay)
  for (let i = 1; i < geometry.length; i++) {
    const [bx, by] = xy(geometry[i]!)
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    // Projection of the point (the origin) onto the segment, clamped to its ends.
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
    ax = bx
    ay = by
  }
  return best
}
