// The normalised lane model produced by interpretLanes().

/** Travel direction of a lane relative to the OSM way's node order. */
export type LaneDirection = 'forward' | 'backward' | 'both_ways'

/** Values of the OSM `turn` key (https://wiki.openstreetmap.org/wiki/Key:turn). */
export const TURN_VALUES = [
  'none',
  'through',
  'left',
  'slight_left',
  'sharp_left',
  'right',
  'slight_right',
  'sharp_right',
  'reverse',
  'merge_to_left',
  'merge_to_right',
] as const
export type TurnValue = (typeof TURN_VALUES)[number]

/** Transport modes for which osm-lanes reads `<mode>:lanes`. */
export const ACCESS_MODES = [
  'access',
  'motor_vehicle',
  'hgv',
  'bus',
  'psv',
  'taxi',
  'hov',
  'bicycle',
] as const
export type AccessMode = (typeof ACCESS_MODES)[number]

/** Values of the OSM `change` key (https://wiki.openstreetmap.org/wiki/Key:change). */
export type ChangeValue = 'yes' | 'no' | 'not_left' | 'not_right'

export interface Lane {
  /** Position within its direction group, 0 = leftmost as seen by a driver using the lane. */
  index: number
  direction: LaneDirection
  /** Turn indications; empty when the lane has none (`none` or no turn:lanes tag). */
  turn: string[]
  /** Per-mode access values taken from `<mode>:lanes`, e.g. `{ bus: 'designated' }`. */
  access: Partial<Record<AccessMode, string>>
  change?: string
  maxspeed?: string
  minspeed?: string
  width?: string
  maxheight?: string
  maxweight?: string
  destination?: string[]
  destinationRef?: string[]
  destinationSymbol?: string[]
  destinationColour?: string
  /** Raw per-lane values keyed by the base key (e.g. `turn`, `bus`, `destination:ref`). */
  raw: Record<string, string>
}

export type WarningCode =
  | 'no-lane-data'
  | 'lane-count-mismatch'
  | 'lane-count-inferred'
  | 'ambiguous-split'
  | 'unknown-value'
  | 'not-interpreted'
  | 'invalid-number'

export interface LaneWarning {
  code: WarningCode
  message: string
  /** The OSM key the warning is about, when applicable. */
  key?: string
}

export interface RoadLanes {
  /** Normalised one-way state: `yes` (with the way), `-1` (against the way) or `no`. */
  oneway: 'yes' | '-1' | 'no'
  /** Lanes in way direction, left to right as seen by their drivers. */
  forward: Lane[]
  /** Lanes against way direction, left to right as seen by their drivers. */
  backward: Lane[]
  /** Centre lanes usable from both directions. */
  bothWays: Lane[]
  /** Whole-road values that apply when no per-lane value is tagged. */
  road: {
    maxspeed?: string
    overtaking?: string
    name?: string
    ref?: string
    highway?: string
  }
  warnings: LaneWarning[]
}

export const totalLanes = (r: RoadLanes): number =>
  r.forward.length + r.backward.length + r.bothWays.length

export const hasDestinations = (r: RoadLanes): boolean =>
  [...r.forward, ...r.backward].some(
    (l) => l.destination?.length || l.destinationRef?.length || l.destinationSymbol?.length,
  )
