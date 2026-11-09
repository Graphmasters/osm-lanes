// Direction of a way's geometry.

import type { LatLon } from './types'

/** Below this ratio of resultant to path length the way has no meaningful overall direction. */
const MIN_STRAIGHTNESS = 0.1

/**
 * Average bearing of a way in its drawing direction (first → last node), in degrees clockwise
 * from north (0 ≤ bearing < 360).
 *
 * The average is the length-weighted circular mean of the segment bearings, computed in a local
 * flat projection (fine for the short distances of a single way). Returns `null` when there are
 * fewer than two distinct nodes, or when the way bends back on itself so much (roundabouts,
 * closed ways, hairpins) that the segments largely cancel out.
 */
export function wayBearing(geometry: readonly LatLon[] | undefined): number | null {
  if (!geometry || geometry.length < 2) return null
  let x = 0
  let y = 0
  let length = 0
  for (let i = 1; i < geometry.length; i++) {
    const a = geometry[i - 1]!
    const b = geometry[i]!
    const dx = (b.lon - a.lon) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
    const dy = b.lat - a.lat
    // Summing segment vectors weights every segment's direction by its length.
    x += dx
    y += dy
    length += Math.hypot(dx, dy)
  }
  const resultant = Math.hypot(x, y)
  if (length === 0 || resultant / length < MIN_STRAIGHTNESS) return null
  const deg = (Math.atan2(x, y) * 180) / Math.PI
  return (deg + 360) % 360
}
