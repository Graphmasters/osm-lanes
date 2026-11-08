// Shared column layout for the lane graphic and the destination-sign graphic, so both can be
// shown on top of each other with matching lane columns.

import { interpretLanes, type Tags } from '../lanes/interpret'
import { cyclewayDirection, type Cycleway } from '../lanes/cycleway'
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
  /** A stand-in carriageway for roads without lane tags (drawn without markings). */
  placeholder?: boolean
}

/** A cycle lane, track or separate cycleway drawn at the left or right edge of the graphic. */
export interface EdgeStrip {
  cycleway: Cycleway
  screenSide: 'left' | 'right'
  /** Left edge and width of the strip, including a kerb/verge gap for tracks. */
  x: number
  width: number
  /** Gap between carriageway and strip (kerb/verge); 0 for cycle lanes on the carriageway. */
  gap: number
  /** Arrow direction on screen. */
  arrows: 'up' | 'down' | 'both'
}

/** Cycleways shown in shared lanes (no strip of their own): drawn inside the outermost lane. */
export interface SharedMarking {
  cycleway: Cycleway
  column: Column
}

export interface Layout {
  cols: Column[]
  strips: EdgeStrip[]
  shared: SharedMarking[]
  /** Total width including margins. */
  width: number
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
  return layout(road, opts).cols
}

const STRIP_TYPES = new Set(['lane', 'track', 'separate'])

/**
 * Which cycleway (way side) appears at which screen edge for the chosen view. Seen in way
 * direction, the way's left is on screen left; the backward view is turned around. A
 * single-direction view of a two-way road only shows its outer (driving-side) edge.
 */
function edgeCycleways(road: RoadLanes, opts: LayoutOptions): { left?: Cycleway; right?: Cycleway } {
  const { direction = 'both', drivingSide = 'right' } = opts
  const cw = road.cycleways ?? {}
  if (direction === 'both') return { left: cw.left, right: cw.right }
  const twoWay = road.oneway === 'no'
  if (direction === 'forward') {
    if (!twoWay) return { left: cw.left, right: cw.right }
    return drivingSide === 'right' ? { right: cw.right } : { left: cw.left }
  }
  if (!twoWay) return { left: cw.right, right: cw.left }
  return drivingSide === 'right' ? { right: cw.left } : { left: cw.right }
}

/** Lanes, cycle strips and shared-lane markings with their x positions. */
export function layout(road: RoadLanes, opts: LayoutOptions = {}): Layout {
  const { direction = 'both', drivingSide = 'right', laneWidth = 64 } = opts
  const edges = edgeCycleways(road, opts)
  const raw = orderedLanes(road, opts)
  const anyCycleway = !!(edges.left || edges.right)
  // Without lane tags there is nothing to draw, unless a cycleway is tagged: then the
  // carriageway is shown as one unmarked block so the cycleways have something to sit next to.
  const placeholder = !raw.length && anyCycleway
  const ordered = placeholder
    ? [{ lane: { index: 0, direction: 'both_ways' as const, turn: [], access: {}, raw: {} }, rotated: false, placeholder: true }]
    : raw
  if (!ordered.length) return { cols: [], strips: [], shared: [], width: MARGIN * 2 }

  const stripWidth = (c: Cycleway) => (c.type === 'separate' ? 18 : Math.round(laneWidth * 0.5))
  const gapFor = (c: Cycleway) => (c.type === 'lane' ? 0 : 8)
  const arrowsFor = (c: Cycleway): EdgeStrip['arrows'] => {
    const d = cyclewayDirection(c, road.oneway, drivingSide)
    if (d === 'both') return 'both'
    const up = direction === 'backward' ? 'backward' : 'forward'
    return d === up ? 'up' : 'down'
  }

  let x = MARGIN
  const strips: EdgeStrip[] = []
  const left = edges.left && STRIP_TYPES.has(edges.left.type) ? edges.left : undefined
  const right = edges.right && STRIP_TYPES.has(edges.right.type) ? edges.right : undefined
  if (left) {
    const w = stripWidth(left)
    const gap = gapFor(left)
    strips.push({ cycleway: left, screenSide: 'left', x, width: w, gap, arrows: arrowsFor(left) })
    x += w + gap
  }
  const cols: Column[] = ordered.map((c, i) => ({ ...c, x: x + i * laneWidth }))
  x += ordered.length * laneWidth
  if (right) {
    const w = stripWidth(right)
    const gap = gapFor(right)
    strips.push({ cycleway: right, screenSide: 'right', x: x + gap, width: w, gap, arrows: arrowsFor(right) })
    x += w + gap
  }

  const shared: SharedMarking[] = []
  if (edges.left && !left) shared.push({ cycleway: edges.left, column: cols[0]! })
  if (edges.right && !right) shared.push({ cycleway: edges.right, column: cols[cols.length - 1]! })
  return { cols, strips, shared, width: x + MARGIN }
}

function orderedLanes(road: RoadLanes, opts: LayoutOptions): { lane: Lane; rotated: boolean }[] {
  const { direction = 'both', drivingSide = 'right' } = opts
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
  return ordered
}
