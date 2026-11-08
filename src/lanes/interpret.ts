// Interprets the lane-related tags of one OSM way into a RoadLanes model.
//
// The rules follow the "Lanes" general extension documented in the OpenStreetMap wiki
// (https://wiki.openstreetmap.org/wiki/Lanes):
//   * `<key>:lanes=a|b|c` lists one value per lane, left to right as seen by the drivers
//     travelling in that lane's direction;
//   * `:forward` lanes travel in the way's direction, `:backward` lanes against it (and are
//     also listed left to right from *their* drivers' point of view);
//   * an empty entry (`a||c`) falls back to the value of the key without `:lanes`.
// Unknown or inconsistent input never throws; it produces warnings instead.

import {
  ACCESS_MODES,
  TURN_VALUES,
  type Lane,
  type LaneDirection,
  type LaneWarning,
  type RoadLanes,
} from './model'
import { interpretCycleways } from './cycleway'
import { parseCount, splitLanes, splitMulti } from './split'

export type Tags = Readonly<Record<string, string>>

/** Base keys read per lane, in the order they are stored on Lane.raw. */
const PER_LANE_KEYS = [
  'turn',
  'change',
  ...ACCESS_MODES,
  'maxspeed',
  'minspeed',
  'width',
  'maxheight',
  'maxweight',
  'destination',
  'destination:ref',
  'destination:symbol',
  'destination:colour',
] as const

const KNOWN_TURN = new Set<string>([...TURN_VALUES, 'slide_left', 'slide_right', 'next_right'])
const KNOWN_CHANGE = new Set(['yes', 'no', 'not_left', 'not_right'])
const DEPRECATED_CHANGE = new Set(['only_left', 'only_right'])
const KNOWN_ACCESS = new Set([
  'yes',
  'no',
  'designated',
  'permissive',
  'destination',
  'delivery',
  'private',
  'permit',
  'customers',
  'agricultural',
  'forestry',
  'discouraged',
  'official',
  'use_sidepath',
  'unknown',
])

const HANDLED_LANE_KEY = new RegExp(
  `^(${PER_LANE_KEYS.join('|')}):lanes(:(forward|backward|both_ways))?$`,
)

function normaliseOneway(tags: Tags): RoadLanes['oneway'] {
  const v = tags['oneway']?.trim()
  if (v === 'yes' || v === 'true' || v === '1') return 'yes'
  if (v === '-1' || v === 'reverse') return '-1'
  if (v === 'no' || v === 'false' || v === '0' || v === 'alternating' || v === 'reversible') {
    return 'no'
  }
  // Implied one-way roads (see https://wiki.openstreetmap.org/wiki/Key:oneway#Implied_oneway_restriction).
  const junction = tags['junction']
  if (junction === 'roundabout' || junction === 'circular') return 'yes'
  if (tags['highway'] === 'motorway') return 'yes'
  return 'no'
}

/** Largest number of `|`-separated entries among all handled `<key>:lanes<suffix>` tags. */
function countFromLaneKeys(tags: Tags, suffix: string): number | undefined {
  let max: number | undefined
  for (const key of PER_LANE_KEYS) {
    const v = tags[`${key}:lanes${suffix}`]
    if (v !== undefined) max = Math.max(max ?? 0, splitLanes(v).length)
  }
  return max
}

interface Groups {
  forward: number
  backward: number
  bothWays: number
}

function laneCounts(tags: Tags, oneway: RoadLanes['oneway'], warnings: LaneWarning[]): Groups {
  const total = parseCount(tags['lanes'])
  if (tags['lanes'] !== undefined && total === undefined) {
    warnings.push({ code: 'invalid-number', key: 'lanes', message: `lanes=${tags['lanes']} is not a whole number.` })
  }

  if (oneway !== 'no') {
    const dir = oneway === 'yes' ? 'forward' : 'backward'
    const n =
      total ??
      parseCount(tags[`lanes:${dir}`]) ??
      countFromLaneKeys(tags, '') ??
      countFromLaneKeys(tags, `:${dir}`)
    if (n === undefined) return { forward: 0, backward: 0, bothWays: 0 }
    if (total === undefined) {
      warnings.push({ code: 'lane-count-inferred', key: 'lanes', message: `No lanes tag; assuming ${n} lane(s) from the per-lane tags.` })
    }
    return dir === 'forward'
      ? { forward: n, backward: 0, bothWays: 0 }
      : { forward: 0, backward: n, bothWays: 0 }
  }

  const bothWays = parseCount(tags['lanes:both_ways']) ?? countFromLaneKeys(tags, ':both_ways') ?? 0
  let forward = parseCount(tags['lanes:forward']) ?? countFromLaneKeys(tags, ':forward')
  let backward = parseCount(tags['lanes:backward']) ?? countFromLaneKeys(tags, ':backward')

  if (total === undefined) {
    if (forward === undefined && backward === undefined && bothWays === 0) {
      return { forward: 0, backward: 0, bothWays: 0 }
    }
    if (tags['lanes:forward'] === undefined && tags['lanes:backward'] === undefined) {
      warnings.push({ code: 'lane-count-inferred', key: 'lanes', message: 'No lanes tag; lane counts inferred from the per-lane tags.' })
    }
    return { forward: forward ?? 0, backward: backward ?? 0, bothWays }
  }

  const rest = total - bothWays
  if (forward === undefined && backward === undefined) {
    if (rest === 1 && bothWays === 0) {
      // A single lane on a two-way road is shared by both directions.
      warnings.push({ code: 'lane-count-inferred', key: 'lanes', message: 'lanes=1 on a two-way road: one lane shared by both directions.' })
      return { forward: 0, backward: 0, bothWays: 1 }
    }
    forward = Math.ceil(rest / 2)
    backward = Math.floor(rest / 2)
    if (rest % 2 !== 0) {
      warnings.push({ code: 'ambiguous-split', key: 'lanes', message: `lanes=${total} on a two-way road is odd and lanes:forward/backward are missing; assuming ${forward} forward and ${backward} backward.` })
    }
    return { forward, backward, bothWays }
  }
  if (forward === undefined) forward = Math.max(0, rest - (backward ?? 0))
  if (backward === undefined) backward = Math.max(0, rest - forward)
  if (forward + backward + bothWays !== total) {
    warnings.push({
      code: 'lane-count-mismatch',
      key: 'lanes',
      message: `lanes=${total}, but forward (${forward}) + backward (${backward}) + both ways (${bothWays}) = ${forward + backward + bothWays}.`,
    })
  }
  return { forward, backward, bothWays }
}

function buildLanes(
  tags: Tags,
  direction: LaneDirection,
  count: number,
  suffixes: readonly string[],
  warnings: LaneWarning[],
): Lane[] {
  const lanes: Lane[] = Array.from({ length: count }, (_, index) => ({
    index,
    direction,
    turn: [],
    access: {},
    raw: {},
  }))
  if (count === 0) return lanes
  const dirSuffix = direction === 'both_ways' ? '' : `:${direction}`

  for (const base of PER_LANE_KEYS) {
    const suffix = suffixes.find((s) => tags[`${base}:lanes${s}`] !== undefined)
    if (suffix === undefined) continue
    const key = `${base}:lanes${suffix}`
    const values = splitLanes(tags[key]!)
    if (values.length !== count) {
      warnings.push({
        code: 'lane-count-mismatch',
        key,
        message: `${key} lists ${values.length} value(s), but there are ${count} ${direction.replace('_', ' ')} lane(s).`,
      })
    }
    const fallback = tags[`${base}${dirSuffix}`] ?? tags[base] ?? ''
    lanes.forEach((lane, i) => {
      const value = (values[i] ?? '') || fallback
      if (value === '') return
      lane.raw[base] = value
      applyValue(lane, base, value, key, warnings)
    })
  }
  return lanes
}

function applyValue(lane: Lane, base: string, value: string, key: string, warnings: LaneWarning[]) {
  switch (base) {
    case 'turn': {
      const turns = splitMulti(value)
      for (const t of turns) {
        if (!KNOWN_TURN.has(t)) {
          warnings.push({ code: 'unknown-value', key, message: `Unknown turn value "${t}".` })
        }
      }
      lane.turn = turns.filter((t) => t !== 'none')
      return
    }
    case 'change':
      if (DEPRECATED_CHANGE.has(value)) {
        warnings.push({ code: 'unknown-value', key, message: `change value "${value}" is deprecated.` })
      } else if (!KNOWN_CHANGE.has(value)) {
        warnings.push({ code: 'unknown-value', key, message: `Unknown change value "${value}".` })
      }
      lane.change = value
      return
    case 'maxspeed':
    case 'minspeed':
    case 'width':
    case 'maxheight':
    case 'maxweight':
      lane[base] = value
      return
    case 'destination':
      lane.destination = splitMulti(value)
      return
    case 'destination:ref':
      lane.destinationRef = splitMulti(value)
      return
    case 'destination:symbol':
      lane.destinationSymbol = splitMulti(value)
      return
    case 'destination:colour':
      lane.destinationColour = value
      return
    default: {
      const mode = base as (typeof ACCESS_MODES)[number]
      if (!KNOWN_ACCESS.has(value)) {
        warnings.push({ code: 'unknown-value', key, message: `Unknown access value "${value}".` })
      }
      lane.access[mode] = value
    }
  }
}

function notInterpreted(tags: Tags, warnings: LaneWarning[]) {
  const skipped = Object.keys(tags)
    .filter((k) => {
      if (HANDLED_LANE_KEY.test(k)) return false
      // Other cycleway:* attributes (surface, segregated, …) do not change the drawing.
      if (k.startsWith('cycleway')) return k.includes(':lanes')
      return (
        k.includes(':lanes') ||
        /^lanes:(psv|bus|taxi|hov)/.test(k) ||
        k.startsWith('placement')
      )
    })
    .sort()
  for (const key of skipped) {
    warnings.push({ code: 'not-interpreted', key, message: `${key} is not interpreted (yet).` })
  }
}

/** Interprets the lane tags of an OSM way. Never throws. */
export function interpretLanes(tags: Tags): RoadLanes {
  const warnings: LaneWarning[] = []
  const oneway = normaliseOneway(tags)
  const counts = laneCounts(tags, oneway, warnings)

  const forwardSuffixes = oneway === 'yes' ? [':forward', ''] : [':forward']
  const backwardSuffixes = oneway === '-1' ? [':backward', ''] : [':backward']

  const result: RoadLanes = {
    oneway,
    forward: buildLanes(tags, 'forward', counts.forward, forwardSuffixes, warnings),
    backward: buildLanes(tags, 'backward', counts.backward, backwardSuffixes, warnings),
    bothWays: buildLanes(tags, 'both_ways', counts.bothWays, [':both_ways'], warnings),
    cycleways: interpretCycleways(tags, oneway, warnings),
    road: {
      maxspeed: tags['maxspeed'],
      overtaking: tags['overtaking'],
      name: tags['name'],
      ref: tags['ref'],
      highway: tags['highway'],
    },
    warnings,
  }

  if (oneway === 'no' && counts.bothWays === 0 && tags['turn:lanes'] !== undefined) {
    warnings.push({
      code: 'not-interpreted',
      key: 'turn:lanes',
      message: 'turn:lanes without :forward/:backward is ambiguous on a two-way road.',
    })
  }
  notInterpreted(tags, warnings)
  if (counts.forward + counts.backward + counts.bothWays === 0) {
    warnings.unshift({ code: 'no-lane-data', message: 'This way has no lane information (lanes, turn:lanes, …).' })
  }
  return result
}
