// Turns a road's lanes around: what the way calls forward becomes backward and vice versa.
// Used to draw a way against its node order, e.g. in the direction of an external record that
// runs the other way.

import type { Cycleway, RoadCycleways } from './cycleway'
import type { Lane, LaneDirection, RoadLanes } from './model'

const FLIP_DIRECTION: Record<LaneDirection, LaneDirection> = { forward: 'backward', backward: 'forward', both_ways: 'both_ways' }
const FLIP_ONEWAY = { yes: '-1', '-1': 'yes', no: 'no' } as const

const flipLane = (lane: Lane): Lane => ({ ...lane, direction: FLIP_DIRECTION[lane.direction] })

function flipCycleway(cw: Cycleway | undefined): Cycleway | undefined {
  if (!cw) return undefined
  const out: Cycleway = { ...cw, side: cw.side === 'left' ? 'right' : 'left' }
  // An unset oneway means "the usual direction for that side", which still holds after the swap.
  if (cw.oneway) out.oneway = FLIP_ONEWAY[cw.oneway]
  return out
}

/**
 * The same road seen against the way's node order: forward and backward lanes swap, `oneway`
 * `yes` ↔ `-1`, and the left and right cycleways swap sides (with an explicit cycleway oneway
 * flipped). The order of the lanes within a direction and the turn values stay as they are: both
 * are relative to the drivers using the lane. Reversing twice gives the original road back.
 */
export function reverseRoadLanes(road: RoadLanes): RoadLanes {
  const cycleways: RoadCycleways = {}
  const left = flipCycleway(road.cycleways.right)
  const right = flipCycleway(road.cycleways.left)
  if (left) cycleways.left = left
  if (right) cycleways.right = right
  return {
    ...road,
    oneway: FLIP_ONEWAY[road.oneway],
    forward: road.backward.map(flipLane),
    backward: road.forward.map(flipLane),
    bothWays: road.bothWays.map(flipLane),
    cycleways,
  }
}
