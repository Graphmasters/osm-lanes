import { describe, expect, it } from 'vitest'
import { interpretLanes } from '../src/lanes/interpret'
import { TURN_VALUES } from '../src/lanes/model'
import { parseCount, splitLanes, splitMulti } from '../src/lanes/split'

const codes = (w: { code: string }[]) => w.map((x) => x.code)

describe('split helpers', () => {
  it('keeps empty lane entries', () => {
    expect(splitLanes('left||right')).toEqual(['left', '', 'right'])
    expect(splitLanes('')).toEqual([''])
  })
  it('splits multi values and drops empties', () => {
    expect(splitMulti('left;through')).toEqual(['left', 'through'])
    expect(splitMulti('')).toEqual([])
  })
  it('parses counts strictly', () => {
    expect(parseCount('3')).toBe(3)
    expect(parseCount('2.5')).toBeUndefined()
    expect(parseCount('two')).toBeUndefined()
    expect(parseCount(undefined)).toBeUndefined()
  })
})

describe('lane counts', () => {
  it('one-way road uses lanes', () => {
    const r = interpretLanes({ highway: 'primary', oneway: 'yes', lanes: '3' })
    expect([r.forward.length, r.backward.length, r.bothWays.length]).toEqual([3, 0, 0])
    expect(r.warnings).toEqual([])
  })

  it('motorways and roundabouts are implicitly one-way', () => {
    expect(interpretLanes({ highway: 'motorway', lanes: '2' }).oneway).toBe('yes')
    expect(interpretLanes({ highway: 'primary', junction: 'roundabout', lanes: '2' }).oneway).toBe('yes')
    expect(interpretLanes({ highway: 'motorway', oneway: 'no', lanes: '2' }).oneway).toBe('no')
  })

  it('oneway=-1 puts all lanes backward and reads unsuffixed keys', () => {
    const r = interpretLanes({ oneway: '-1', lanes: '2', 'turn:lanes': 'left|through' })
    expect(r.forward).toHaveLength(0)
    expect(r.backward.map((l) => l.turn)).toEqual([['left'], ['through']])
  })

  it('two-way road with explicit forward/backward', () => {
    const r = interpretLanes({ lanes: '3', 'lanes:forward': '2', 'lanes:backward': '1' })
    expect([r.forward.length, r.backward.length]).toEqual([2, 1])
    expect(r.warnings).toEqual([])
  })

  it('derives the missing direction from the total', () => {
    const r = interpretLanes({ lanes: '4', 'lanes:forward': '3' })
    expect([r.forward.length, r.backward.length]).toEqual([3, 1])
  })

  it('splits an even total equally without warning', () => {
    const r = interpretLanes({ lanes: '4' })
    expect([r.forward.length, r.backward.length]).toEqual([2, 2])
    expect(r.warnings).toEqual([])
  })

  it('warns about an odd total without direction counts', () => {
    const r = interpretLanes({ lanes: '3' })
    expect(codes(r.warnings)).toContain('ambiguous-split')
  })

  it('treats lanes=1 on a two-way road as one shared lane', () => {
    const r = interpretLanes({ lanes: '1' })
    expect([r.forward.length, r.backward.length, r.bothWays.length]).toEqual([0, 0, 1])
  })

  it('handles lanes:both_ways', () => {
    const r = interpretLanes({
      lanes: '3',
      'lanes:forward': '1',
      'lanes:backward': '1',
      'lanes:both_ways': '1',
      'turn:lanes:both_ways': 'left',
    })
    expect(r.bothWays).toHaveLength(1)
    expect(r.bothWays[0]!.turn).toEqual(['left'])
    expect(r.warnings).toEqual([])
  })

  it('warns on inconsistent totals', () => {
    const r = interpretLanes({ lanes: '3', 'lanes:forward': '2', 'lanes:backward': '2' })
    expect(codes(r.warnings)).toContain('lane-count-mismatch')
  })

  it('infers the count from per-lane tags when lanes is missing', () => {
    const r = interpretLanes({ oneway: 'yes', 'turn:lanes': 'left|through|right' })
    expect(r.forward).toHaveLength(3)
    expect(codes(r.warnings)).toContain('lane-count-inferred')
  })

  it('reports ways without lane data', () => {
    const r = interpretLanes({ highway: 'residential' })
    expect(r.forward.length + r.backward.length + r.bothWays.length).toBe(0)
    expect(codes(r.warnings)).toEqual(['no-lane-data'])
  })

  it('reports invalid lane numbers', () => {
    const r = interpretLanes({ oneway: 'yes', lanes: '2;3' })
    expect(codes(r.warnings)).toContain('invalid-number')
  })
})

describe('per-lane values', () => {
  it('keeps forward and backward lanes in their own drivers’ order', () => {
    const r = interpretLanes({
      lanes: '4',
      'lanes:forward': '2',
      'lanes:backward': '2',
      'turn:lanes:forward': 'left|through;right',
      'turn:lanes:backward': 'left;through|right',
    })
    expect(r.forward.map((l) => l.turn)).toEqual([['left'], ['through', 'right']])
    expect(r.backward.map((l) => l.turn)).toEqual([['left', 'through'], ['right']])
    expect(r.backward.map((l) => l.index)).toEqual([0, 1])
  })

  it('accepts every documented turn value and drops none', () => {
    const values = TURN_VALUES.filter((v) => v !== 'none')
    const r = interpretLanes({
      oneway: 'yes',
      lanes: String(values.length + 1),
      'turn:lanes': ['none', ...values].join('|'),
    })
    expect(r.forward[0]!.turn).toEqual([])
    expect(r.forward.slice(1).map((l) => l.turn[0])).toEqual(values)
    expect(r.warnings).toEqual([])
  })

  it('falls back to the base key for empty entries', () => {
    const r = interpretLanes({
      oneway: 'yes',
      lanes: '3',
      maxspeed: '80',
      'maxspeed:lanes': '100||60',
    })
    expect(r.forward.map((l) => l.maxspeed)).toEqual(['100', '80', '60'])
  })

  it('maps access per mode', () => {
    const r = interpretLanes({
      oneway: 'yes',
      lanes: '3',
      'bus:lanes': '||designated',
      'hgv:lanes': 'no||',
      'bicycle:lanes': 'yes|yes|designated',
    })
    expect(r.forward.map((l) => l.access)).toEqual([
      { hgv: 'no', bicycle: 'yes' },
      { bicycle: 'yes' },
      { bus: 'designated', bicycle: 'designated' },
    ])
  })

  it('parses destinations', () => {
    const r = interpretLanes({
      oneway: 'yes',
      lanes: '2',
      'destination:lanes': 'Hannover;Celle|Berlin',
      'destination:ref:lanes': 'A 2|A 7',
      'destination:symbol:lanes': 'airport|',
      'destination:colour:lanes': 'blue|yellow',
    })
    expect(r.forward[0]).toMatchObject({
      destination: ['Hannover', 'Celle'],
      destinationRef: ['A 2'],
      destinationSymbol: ['airport'],
      destinationColour: 'blue',
    })
    expect(r.forward[1]).toMatchObject({ destination: ['Berlin'], destinationRef: ['A 7'] })
    expect(r.forward[1]!.destinationSymbol).toBeUndefined()
  })

  it('warns on value count mismatch and missing entries stay empty', () => {
    const r = interpretLanes({ oneway: 'yes', lanes: '3', 'turn:lanes': 'left|through' })
    expect(codes(r.warnings)).toContain('lane-count-mismatch')
    expect(r.forward[2]!.turn).toEqual([])
  })

  it('warns on unknown values instead of throwing', () => {
    const r = interpretLanes({
      oneway: 'yes',
      lanes: '2',
      'turn:lanes': 'left|banana',
      'change:lanes': 'only_left|maybe',
      'bus:lanes': 'designated|sometimes',
    })
    expect(r.warnings.filter((w) => w.code === 'unknown-value')).toHaveLength(4)
    expect(r.forward[1]!.turn).toEqual(['banana'])
  })

  it('lists lane keys that are not interpreted', () => {
    const r = interpretLanes({
      oneway: 'yes',
      lanes: '2',
      'maxspeed:lanes:conditional': '60 @ (22:00-06:00)|',
      placement: 'right_of:1',
      'cycleway:right': 'lane',
    })
    const skipped = r.warnings.filter((w) => w.code === 'not-interpreted').map((w) => w.key)
    expect(skipped).toEqual(['cycleway:right', 'maxspeed:lanes:conditional', 'placement'])
  })

  it('flags unsuffixed turn:lanes on two-way roads', () => {
    const r = interpretLanes({ lanes: '2', 'turn:lanes': 'left|right' })
    expect(r.warnings.map((w) => w.key)).toContain('turn:lanes')
  })
})
