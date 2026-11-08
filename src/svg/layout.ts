// Shared column layout for the lane graphic and the destination-sign graphic, so both can be
// shown on top of each other with matching lane columns.

import { interpretLanes, type Tags } from '../lanes/interpret'
import type { Lane, RoadLanes } from '../lanes/model'
import type { OsmWay } from '../osm/types'

export type LanesInput = RoadLanes | Tags | OsmWay

export interface LayoutOptions {
  /** Which lanes to draw (default `both`). `backward` draws them from their own drivers' view. */
  direction?: 'both' | 'forward' | 'backward'
  /** Side of the road traffic keeps to (default `right`, as in Germany). */
  drivingSide?: 'right' | 'left'
  /** Width of one lane column in SVG user units (default 64). */
  laneWidth?: number
}

export interface Column {
  lane: Lane
  /** Drawn upside down (oncoming lanes seen from the forward driver's viewpoint). */
  rotated: boolean
  x: number
}

export const MARGIN = 8

export function toRoadLanes(input: LanesInput): RoadLanes {
  const maybe = input as Partial<RoadLanes>
  if (Array.isArray(maybe.forward) && Array.isArray(maybe.backward) && Array.isArray(maybe.warnings)) {
    return input as RoadLanes
  }
  const way = input as Partial<OsmWay>
  if (way.type === 'way' && typeof way.tags === 'object' && way.tags !== null) {
    return interpretLanes(way.tags)
  }
  return interpretLanes(input as Tags)
}

/** Screen order of lanes, left to right, as seen by a driver in way direction. */
export function columns(road: RoadLanes, opts: LayoutOptions = {}): Column[] {
  const { direction = 'both', drivingSide = 'right', laneWidth = 64 } = opts
  let ordered: { lane: Lane; rotated: boolean }[]
  if (direction === 'forward') {
    ordered = [...road.bothWays, ...road.forward].map((lane) => ({ lane, rotated: false }))
  } else if (direction === 'backward') {
    ordered = [...road.bothWays, ...road.backward].map((lane) => ({ lane, rotated: false }))
  } else {
    // Oncoming lanes are listed left→right from their drivers' view, i.e. reversed for us.
    const oncoming = [...road.backward].reverse().map((lane) => ({ lane, rotated: true }))
    const centre = road.bothWays.map((lane) => ({ lane, rotated: false }))
    const own = road.forward.map((lane) => ({ lane, rotated: false }))
    ordered = drivingSide === 'right' ? [...oncoming, ...centre, ...own] : [...own, ...centre, ...oncoming]
  }
  return ordered.map((c, i) => ({ ...c, x: MARGIN + i * laneWidth }))
}
