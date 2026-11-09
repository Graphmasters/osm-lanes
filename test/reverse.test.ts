import { describe, expect, it } from 'vitest'
import { interpretLanes } from '../src/lanes/interpret'
import { reverseRoadLanes } from '../src/lanes/reverse'
import { renderDestinationSignSvg } from '../src/svg/destination'
import { columns } from '../src/svg/layout'
import { renderLanesSvg } from '../src/svg/render'

const twoWay = {
  highway: 'primary',
  lanes: '3',
  'lanes:forward': '2',
  'lanes:backward': '1',
  'turn:lanes:forward': 'left|through',
  'turn:lanes:backward': 'through;right',
  'destination:lanes:forward': 'Köln|Bonn',
  'cycleway:left': 'track',
  'cycleway:left:oneway': '-1',
  'cycleway:right': 'lane',
}

describe('reverseRoadLanes', () => {
  it('swaps forward and backward lanes and keeps their order and turns', () => {
    const r = reverseRoadLanes(interpretLanes(twoWay))
    expect(r.oneway).toBe('no')
    expect(r.forward.map((l) => [l.direction, l.turn])).toEqual([['forward', ['through', 'right']]])
    expect(r.backward.map((l) => [l.direction, l.turn])).toEqual([
      ['backward', ['left']],
      ['backward', ['through']],
    ])
  })
  it('swaps the cycleway sides and flips an explicit cycleway oneway', () => {
    const r = reverseRoadLanes(interpretLanes(twoWay))
    expect(r.cycleways.left).toMatchObject({ side: 'left', type: 'lane' })
    expect(r.cycleways.left?.oneway).toBeUndefined()
    expect(r.cycleways.right).toMatchObject({ side: 'right', type: 'track', oneway: 'yes' })
  })
  it('flips one-way roads', () => {
    const road = interpretLanes({ highway: 'primary', oneway: 'yes', lanes: '2', 'turn:lanes': 'left|through' })
    const r = reverseRoadLanes(road)
    expect(r.oneway).toBe('-1')
    expect(r.forward).toEqual([])
    expect(r.backward.map((l) => l.turn)).toEqual([['left'], ['through']])
    expect(reverseRoadLanes(interpretLanes({ oneway: '-1', lanes: '1' })).oneway).toBe('yes')
  })
  it('gives the original road back when applied twice', () => {
    const road = interpretLanes(twoWay)
    expect(reverseRoadLanes(reverseRoadLanes(road))).toEqual(road)
  })
  it('does not change the input', () => {
    const road = interpretLanes(twoWay)
    const copy = structuredClone(road)
    reverseRoadLanes(road)
    expect(road).toEqual(copy)
  })
})

describe('reverse render option', () => {
  it('draws the reversed road', () => {
    const road = interpretLanes(twoWay)
    expect(renderLanesSvg(twoWay, { reverse: true })).toBe(renderLanesSvg(reverseRoadLanes(road)))
    expect(renderDestinationSignSvg(twoWay, { reverse: true, side: 'below' })).toBe(renderDestinationSignSvg(reverseRoadLanes(road), { side: 'below' }))
    expect(renderLanesSvg(twoWay, { reverse: true })).not.toBe(renderLanesSvg(twoWay))
  })
  it('puts the former forward lanes on the oncoming side', () => {
    const cols = columns(reverseRoadLanes(interpretLanes(twoWay)))
    expect(cols.map((c) => [c.lane.direction, c.rotated])).toEqual([
      ['backward', true],
      ['backward', true],
      ['forward', false],
    ])
  })
})
