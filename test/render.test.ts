import { describe, expect, it } from 'vitest'
import { interpretLanes } from '../src/lanes/interpret'
import { arrowSvg } from '../src/svg/arrows'
import { renderDestinationSignSvg, wrap } from '../src/svg/destination'
import { esc } from '../src/svg/el'
import { columns } from '../src/svg/layout'
import { getLanesLegend } from '../src/svg/legend'
import { laneChips, laneSigns, renderLanesSvg } from '../src/svg/render'
import { ICONS } from '../src/svg/icons'
import { SIGNS } from '../src/svg/signs'

const twoWay = {
  highway: 'primary',
  lanes: '4',
  'lanes:forward': '2',
  'lanes:backward': '2',
  'turn:lanes:forward': 'left|through;right',
  'turn:lanes:backward': 'through|right',
}

describe('layout', () => {
  it('orders oncoming lanes reversed on the left for right-hand traffic', () => {
    const road = interpretLanes(twoWay)
    const cols = columns(road)
    expect(cols.map((c) => [c.lane.direction, c.lane.index, c.rotated])).toEqual([
      ['backward', 1, true],
      ['backward', 0, true],
      ['forward', 0, false],
      ['forward', 1, false],
    ])
    expect(cols.map((c) => c.x)).toEqual([8, 72, 136, 200])
  })
  it('puts oncoming lanes on the right for left-hand traffic', () => {
    const cols = columns(interpretLanes(twoWay), { drivingSide: 'left' })
    expect(cols.map((c) => c.lane.direction)).toEqual(['forward', 'forward', 'backward', 'backward'])
  })
  it('can show a single direction from its drivers’ view', () => {
    const cols = columns(interpretLanes(twoWay), { direction: 'backward' })
    expect(cols.map((c) => [c.lane.index, c.rotated])).toEqual([
      [0, false],
      [1, false],
    ])
  })
})

describe('renderLanesSvg', () => {
  it('returns an empty string without lanes', () => {
    expect(renderLanesSvg({ highway: 'residential' })).toBe('')
  })

  it('accepts tags, OsmWay and RoadLanes alike', () => {
    const a = renderLanesSvg(twoWay)
    const b = renderLanesSvg({ type: 'way', id: '1', tags: twoWay })
    const c = renderLanesSvg(interpretLanes(twoWay))
    expect(a).toBe(b)
    expect(a).toBe(c)
    expect(a.startsWith('<svg')).toBe(true)
    expect(a).toContain('viewBox="0 0 272 166"')
  })

  it('emits xmlns only when standalone', () => {
    expect(renderLanesSvg(twoWay)).not.toContain('xmlns=')
    expect(renderLanesSvg(twoWay, { standalone: true })).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('draws one arrow per lane with turns and rotates oncoming ones', () => {
    const svg = renderLanesSvg(twoWay)
    expect(svg.match(/class="osml-arrow"/g)).toHaveLength(4)
    expect(svg.match(/rotate\(180\)/g)).toHaveLength(2)
  })

  it('draws solid lines where lane changes are forbidden', () => {
    const solid = renderLanesSvg({ oneway: 'yes', lanes: '2', 'change:lanes': 'not_right|not_left' })
    const dashed = renderLanesSvg({ oneway: 'yes', lanes: '2' })
    expect(dashed).toContain('stroke-dasharray')
    expect(solid.match(/stroke-dasharray/g)).toBeNull()
    const mixed = renderLanesSvg({ oneway: 'yes', lanes: '2', 'change:lanes': 'not_right|yes' })
    expect(mixed.match(/stroke-dasharray/g)).toHaveLength(1)
  })

  it('uses Commons sign symbols when a matching file exists, generic ones otherwise', () => {
    const svg = renderLanesSvg({ oneway: 'yes', lanes: '3', 'maxspeed:lanes': '120|100|45' })
    expect(svg).toContain('<symbol id="osml-sign-274-120"')
    expect(svg).toContain('href="#osml-sign-274-100"')
    expect(svg).toContain('osml-sign-generic')
    expect(svg).toContain('>45</text>')
  })

  it('escapes hostile tag values', () => {
    const svg = renderLanesSvg({ oneway: 'yes', lanes: '1', 'width:lanes': '<script>"&\'' }, { ariaLabel: '<b>"x"' })
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;&quot;&amp;&#39;')
    expect(svg).toContain('aria-label="&lt;b&gt;&quot;x&quot;"')
  })

  it('appends a legend on request', () => {
    const svg = renderLanesSvg(twoWay, { legend: true, locale: 'de' })
    expect(svg).toContain('geradeaus')
  })
})

describe('access and signs', () => {
  it('maps designated and prohibited modes to icon chips', () => {
    const road = interpretLanes({
      oneway: 'yes',
      lanes: '2',
      'bus:lanes': '|designated',
      'psv:lanes': '|designated',
      'hgv:lanes': 'no|',
    })
    expect(laneChips(road.forward[0]!)).toEqual([{ mode: 'hgv', value: 'no' }])
    expect(laneChips(road.forward[1]!)).toEqual([{ mode: 'bus', value: 'designated' }])
    expect(laneSigns(road.forward[1]!).map((s) => s.key)).toEqual(['245'])
    expect(laneSigns(road.forward[0]!).map((s) => s.key)).toEqual(['253'])
  })

  it('has every icon and sign the renderer refers to', () => {
    for (const k of ['motor_vehicle', 'hgv', 'bus', 'psv', 'taxi', 'hov', 'bicycle']) expect(ICONS[k]).toBeDefined()
    for (const k of ['245', '237', '250', '260', '253', '254', '274-50', '275-30', '265-3.8', '262-5.5']) {
      expect(SIGNS[k], k).toBeDefined()
    }
  })

  it('keeps generated sign markup free of scripts and editor cruft', () => {
    for (const [k, s] of Object.entries(SIGNS)) {
      expect(s.body, k).not.toMatch(/<script|<foreignObject|\son\w+=|sodipodi:|inkscape:/i)
    }
  })
})

describe('arrows', () => {
  it('renders every documented turn value', () => {
    for (const t of ['through', 'left', 'slight_left', 'sharp_left', 'right', 'slight_right', 'sharp_right', 'reverse', 'merge_to_left', 'merge_to_right']) {
      expect(arrowSvg([t], 0, 0), t).toContain('<path')
    }
  })
  it('renders nothing for no turns and a question mark for unknown ones', () => {
    expect(arrowSvg([], 0, 0)).toBe('')
    expect(arrowSvg(['banana'], 0, 0)).toContain('>?</text>')
  })
  it('mirrors right turns', () => {
    const left = arrowSvg(['left'], 0, 0)
    const right = arrowSvg(['right'], 0, 0)
    expect(left).toContain('-13')
    expect(right).toContain('Q 0 -58 13 -58')
  })
})

describe('destination sign', () => {
  const tags = {
    highway: 'motorway',
    lanes: '3',
    'destination:lanes': 'Hamburg;Hannover|Hamburg;Hannover|Kassel',
    'destination:ref:lanes': 'A 7|A 7|A 7',
    'destination:symbol:lanes': '||airport',
  }

  it('returns an empty string without destinations', () => {
    expect(renderDestinationSignSvg(twoWay)).toBe('')
  })

  it('merges identical neighbouring lanes into one panel and aligns with the lane columns', () => {
    const svg = renderDestinationSignSvg(tags)
    expect(svg.match(/class="osml-destination-panel"/g)).toHaveLength(2)
    expect(svg).toContain('viewBox="0 0 208 ')
    expect(svg).toContain('fill="#1d5ca8"') // motorway blue
    expect(svg).toContain('>Kassel</text>')
    expect(svg).toContain(ICONS.airport!.d)
  })

  it('honours destination:colour and escapes text', () => {
    const svg = renderDestinationSignSvg({
      oneway: 'yes',
      lanes: '1',
      'destination:lanes': '<Mitte & "Süd">',
      'destination:colour:lanes': 'white',
    })
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('&lt;Mitte')
    expect(svg).toContain('&amp;')
    expect(svg).toContain('&quot;Süd&quot;&gt;')
    expect(svg).not.toContain('<Mitte')
  })

  it('wraps long names', () => {
    expect(wrap('Hannover-Messe/Laatzen', 10)).toEqual(['Hannover-', 'Messe/', 'Laatzen'])
    expect(wrap('Ein sehr langer Ortsname mit vielen Teilen', 8, 2)).toHaveLength(2)
    expect(wrap('Herrenhausen', 9)).toEqual(['Herrenhausen'])
    expect(wrap('Donaudampfschifffahrt', 9)).toEqual(['Donaudampfs…'])
  })
})

describe('legend', () => {
  it('lists turn values and access', () => {
    const road = interpretLanes({ oneway: 'yes', lanes: '2', 'turn:lanes': 'left|through', 'bus:lanes': '|designated' })
    expect(getLanesLegend(road).map((e) => e.id)).toEqual(['turn.left', 'turn.through', 'designated.bus'])
  })
})

it('esc covers all XML specials', () => {
  expect(esc(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
})
