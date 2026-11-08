// Interprets the cycleway tagging of a road (https://wiki.openstreetmap.org/wiki/Key:cycleway):
// cycle lanes painted on the carriageway, cycle tracks next to it, shared lanes and cycleways
// mapped as separate ways.
//
//   cycleway=*            both sides of a two-way road; the right side of a one-way road
//   cycleway:both=*       both sides
//   cycleway:left/right=* one side, "left"/"right" relative to the way's direction
//   cycleway:<side>:lane  exclusive | advisory | pictogram (the painted line)
//   cycleway:<side>:oneway yes | -1 | no (direction relative to the way)
//   cycleway:<side>:width
//
// More specific keys win: cycleway:left:lane > cycleway:both:lane > cycleway:lane.

import type { LaneWarning } from './model'

export type CyclewaySide = 'left' | 'right'

/** Kinds of cycle infrastructure that osm-lanes draws. */
export type CyclewayType = 'lane' | 'track' | 'shared_lane' | 'share_busway' | 'separate'

export interface Cycleway {
  /** Side of the road, relative to the way's direction. */
  side: CyclewaySide
  type: CyclewayType
  /** cycleway:<side>:lane — `exclusive`, `advisory` (dashed) or `pictogram`. */
  lane?: string
  /**
   * cycleway:<side>:oneway as tagged (`yes`, `-1`, `no`), or `-1` for the deprecated
   * opposite_* values. Undefined means the usual direction for that side of the road.
   */
  oneway?: 'yes' | '-1' | 'no'
  width?: string
  /** The value that produced this entry, e.g. `lane` or `opposite_track`. */
  value: string
  /** The key the value came from, e.g. `cycleway:right`. */
  key: string
}

export interface RoadCycleways {
  left?: Cycleway
  right?: Cycleway
}

type Tags = Readonly<Record<string, string>>

const TYPES: Record<string, { type: CyclewayType; opposite?: boolean }> = {
  lane: { type: 'lane' },
  track: { type: 'track' },
  shared_lane: { type: 'shared_lane' },
  share_busway: { type: 'share_busway' },
  separate: { type: 'separate' },
  opposite_lane: { type: 'lane', opposite: true },
  opposite_track: { type: 'track', opposite: true },
  opposite_share_busway: { type: 'share_busway', opposite: true },
}
/** Values that mean "nothing to draw" on that side. */
const NONE = new Set(['no', 'none', 'opposite'])
const LANE_VALUES = new Set(['exclusive', 'advisory', 'pictogram'])

function normaliseOneway(v: string | undefined): Cycleway['oneway'] {
  if (v === 'yes' || v === '1' || v === 'true') return 'yes'
  if (v === '-1' || v === 'reverse') return '-1'
  if (v === 'no' || v === 'false' || v === '0') return 'no'
  return undefined
}

/**
 * Reads the cycleways on both sides of a road. `oneway` is the road's normalised one-way state;
 * a plain `cycleway=*` on a one-way road applies to its right side only (the common case in
 * right-hand traffic), a deprecated `opposite_*` value to the left side.
 */
export function interpretCycleways(tags: Tags, oneway: 'yes' | '-1' | 'no', warnings: LaneWarning[]): RoadCycleways {
  const out: RoadCycleways = {}
  for (const side of ['left', 'right'] as const) {
    const candidates: string[] = [`cycleway:${side}`, 'cycleway:both']
    // Plain cycleway=*: both sides of a two-way road; on a one-way road the right side, or the
    // left side for a contraflow (opposite_*) value.
    const plain = tags['cycleway']?.trim()
    if (plain !== undefined) {
      const opposite = plain.startsWith('opposite')
      if (oneway === 'no' || (side === 'right' && !opposite) || (side === 'left' && opposite)) candidates.push('cycleway')
    }
    const key = candidates.find((k) => tags[k] !== undefined)
    if (!key) continue
    const value = tags[key]!.trim()
    if (NONE.has(value)) continue
    const known = TYPES[value]
    if (!known) {
      warnings.push({ code: 'unknown-value', key, message: `Unknown cycleway value "${value}".` })
      continue
    }
    if (known.opposite) {
      warnings.push({
        code: 'unknown-value',
        key,
        message: `${key}=${value} is deprecated; use cycleway:${side}=${known.type} with cycleway:${side}:oneway=-1.`,
      })
    }
    const sub = (name: string) =>
      tags[`cycleway:${side}:${name}`] ?? tags[`cycleway:both:${name}`] ?? (key === 'cycleway' ? tags[`cycleway:${name}`] : undefined)

    const cw: Cycleway = { side, type: known.type, value, key }
    const lane = sub('lane')?.trim()
    if (lane) {
      if (!LANE_VALUES.has(lane)) {
        warnings.push({ code: 'unknown-value', key: `cycleway:${side}:lane`, message: `Unknown cycleway lane value "${lane}".` })
      }
      cw.lane = lane
    }
    const dir = known.opposite ? '-1' : normaliseOneway(sub('oneway')?.trim())
    if (dir) cw.oneway = dir
    const width = sub('width')?.trim()
    if (width) cw.width = width
    out[side] = cw
  }
  return out
}

/** Travel direction of a cycleway relative to the way: `forward`, `backward` or `both`. */
export function cyclewayDirection(
  cw: Cycleway,
  roadOneway: 'yes' | '-1' | 'no',
  drivingSide: 'right' | 'left' = 'right',
): 'forward' | 'backward' | 'both' {
  if (cw.oneway === 'yes') return 'forward'
  if (cw.oneway === '-1') return 'backward'
  if (cw.oneway === 'no') return 'both'
  if (roadOneway === 'yes') return 'forward'
  if (roadOneway === '-1') return 'backward'
  // Two-way road: each side carries the traffic keeping to that side.
  return cw.side === drivingSide ? 'forward' : 'backward'
}

export const hasCycleways = (c: RoadCycleways | undefined): boolean => !!(c?.left || c?.right)
