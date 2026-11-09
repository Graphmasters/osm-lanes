// Renders the lane graphic: one column per lane with road markings, turn arrows, access icons
// and per-lane regulatory signs.

import type { AccessMode, Lane, RoadLanes } from '../lanes/model'
import { arrowSvg } from './arrows'
import { el, esc, round, text, toElement, SVG_NS } from './el'
import { ICONS } from './icons'
import { label, type Locale } from './labels'
import { layout, MARGIN, toRoadLanes, type Column, type EdgeStrip, type LanesInput, type LayoutOptions, type SharedMarking } from './layout'
import { cyclewayLabelKey, getLanesLegend } from './legend'
import { heightSign, SignDefs, speedSign, weightSign, type SignRef } from './sign-render'

export interface RenderOptions extends LayoutOptions {
  ariaLabel?: string
  className?: string
  /** Append a textual legend below the graphic (default false). */
  legend?: boolean
  locale?: Locale
  /** Overrides for individual UI strings (see LABELS). */
  labels?: Partial<Record<string, string>>
  /** Emit the xmlns attribute so the string can be saved as a standalone .svg file. */
  standalone?: boolean
  /** Draw per-lane StVO signs (speed limits, bus lane, …) above the lanes (default true). */
  showSigns?: boolean
  /** Prefix for element IDs, to keep several graphics on one page apart (default `osml`). */
  idPrefix?: string
}

const ROAD_H = 150
const SIGN = 26
const SIGN_ROW = 32
const ICON = 22
const SURFACE = '#4b5057'
const LINE = '#f4f4f4'
const CYCLE_LANE = '#a33b2c'
const CYCLE_TRACK = '#b85a43'
const KERB = '#a7adb3'
const SEPARATE = '#d4d8dc'

const TINT: Partial<Record<AccessMode, string>> = {
  bus: '#8a4a3f',
  psv: '#8a4a3f',
  taxi: '#8a4a3f',
  bicycle: '#a33b2c',
  hov: '#3f5f86',
}

const ICON_ORDER: AccessMode[] = ['bus', 'psv', 'taxi', 'hov', 'bicycle', 'hgv', 'motor_vehicle', 'access']

/** Icon key for an access mode (ICONS has no generic "access" icon; it uses car). */
const iconFor = (mode: AccessMode) => (mode === 'access' ? 'motor_vehicle' : mode)

interface Chip {
  mode: AccessMode
  value: 'designated' | 'no'
}

export function laneChips(lane: Lane): Chip[] {
  const chips: Chip[] = []
  for (const mode of ICON_ORDER) {
    const v = lane.access[mode]
    if (v === 'designated' || v === 'no') chips.push({ mode, value: v })
  }
  // A bus lane tagged as psv=designated and bus=designated needs one bus icon only.
  if (chips.some((c) => c.mode === 'bus' && c.value === 'designated')) {
    return chips.filter((c) => !(c.mode === 'psv' && c.value === 'designated'))
  }
  return chips
}

export function laneSigns(lane: Lane): SignRef[] {
  const signs: SignRef[] = []
  const a = lane.access
  if (a.bus === 'designated' || a.psv === 'designated') signs.push({ key: '245', title: 'Z. 245' })
  if (a.bicycle === 'designated') signs.push({ key: '237', title: 'Z. 237' })
  if (a.access === 'no') signs.push({ key: '250', title: 'Z. 250' })
  else if (a.motor_vehicle === 'no') signs.push({ key: '260', title: 'Z. 260' })
  if (a.hgv === 'no') signs.push({ key: '253', title: 'Z. 253' })
  if (a.bicycle === 'no') signs.push({ key: '254', title: 'Z. 254' })
  const push = (s: SignRef | undefined) => s && signs.push(s)
  if (lane.maxspeed) push(speedSign(lane.maxspeed))
  if (lane.minspeed) push(speedSign(lane.minspeed, true))
  if (lane.maxheight) push(heightSign(lane.maxheight))
  if (lane.maxweight) push(weightSign(lane.maxweight))
  return signs
}

function laneTint(lane: Lane): string {
  for (const mode of ['bus', 'psv', 'taxi', 'hov', 'bicycle'] as const) {
    if (lane.access[mode] === 'designated') return TINT[mode]!
  }
  return SURFACE
}

const metres = (w: string) => (/^\d+(\.\d+)?$/.test(w) ? `${w} m` : w)

type LineStyle = 'dashed' | 'solid' | 'solid-dashed' | 'dashed-solid'

function forbids(lane: Lane, side: 'left' | 'right', rotated: boolean): boolean {
  const driverSide = rotated ? (side === 'left' ? 'right' : 'left') : side
  const c = lane.change
  return c === 'no' || c === `not_${driverSide}` || c === `only_${driverSide === 'left' ? 'right' : 'left'}`
}

function separator(a: Column, b: Column, road: RoadLanes): LineStyle {
  if (a.lane.direction !== b.lane.direction) {
    return road.road.overtaking === 'no' ? 'solid' : 'dashed'
  }
  const l = forbids(a.lane, 'right', a.rotated)
  const r = forbids(b.lane, 'left', b.rotated)
  if (l && r) return 'solid'
  if (l) return 'solid-dashed'
  if (r) return 'dashed-solid'
  return 'dashed'
}

function lineSvg(x: number, y: number, h: number, style: LineStyle): string {
  const dashed = { stroke: LINE, 'stroke-width': 2.5, 'stroke-dasharray': '18 14' }
  const solid = { stroke: LINE, 'stroke-width': 2.5 }
  const v = (dx: number, attrs: Record<string, string | number>) =>
    el('line', { x1: round(x + dx), y1: y, x2: round(x + dx), y2: y + h, ...attrs })
  switch (style) {
    case 'dashed':
      return v(0, dashed)
    case 'solid':
      return v(0, solid)
    case 'solid-dashed':
      return v(-2.2, solid) + v(2.2, dashed)
    case 'dashed-solid':
      return v(-2.2, dashed) + v(2.2, solid)
  }
}

function iconSvg(key: string, x: number, y: number, size: number, colour: string, crossed: boolean): string {
  const icon = ICONS[key]
  if (!icon) return ''
  const s = size / 15
  // Prohibited modes are drawn dark on a white disc with a red bar, like a prohibition sign.
  const fill = crossed ? '#222' : colour
  const parts = [el('path', { d: icon.d, fill, transform: `translate(${round(x)} ${round(y)}) scale(${round(s)})` })]
  if (crossed) {
    parts.unshift(el('circle', { cx: round(x + size / 2), cy: round(y + size / 2), r: round(size * 0.62), fill: '#fff' }))
    parts.push(
      el('line', {
        x1: round(x - size * 0.05),
        y1: round(y + size * 1.05),
        x2: round(x + size * 1.05),
        y2: round(y - size * 0.05),
        stroke: '#c1121c',
        'stroke-width': 2.5,
        'stroke-linecap': 'round',
      }),
    )
  }
  return el('g', { class: 'osml-icon' }, parts)
}

/** Small direction arrow(s) for a cycle strip, centred at cx with its foot at y (pointing up). */
function stripArrows(cx: number, y: number, h: number, arrows: EdgeStrip['arrows']): string {
  const one = (x: number, up: boolean, scale: number) => {
    const a = arrowSvg(['through'], 0, 0, { scale })
    return up
      ? el('g', { transform: `translate(${round(x)} ${round(y)})` }, a)
      : el('g', { transform: `translate(${round(x)} ${round(y - h)}) rotate(180)` }, a)
  }
  if (arrows === 'both') return one(cx - 6, true, 0.42) + one(cx + 6, false, 0.42)
  return one(cx, arrows === 'up', 0.5)
}

function stripSvg(strip: EdgeStrip, roadY: number, locale: Locale, labels: RenderOptions['labels']): string {
  const cw = strip.cycleway
  const title = el('title', {}, esc(label(locale, cyclewayLabelKey(cw), labels)))
  const parts: string[] = [title]
  const { width: w, gap } = strip
  const sx = strip.x
  const cx = sx + w / 2
  if (gap) {
    // kerb / verge between carriageway and track
    const gx = strip.screenSide === 'left' ? sx + w : sx - gap
    parts.push(el('rect', { x: round(gx), y: roadY, width: gap, height: ROAD_H, fill: KERB }))
  }
  if (cw.type === 'separate') {
    parts.push(
      el('rect', { x: round(sx + 1), y: roadY + 1, width: w - 2, height: ROAD_H - 2, fill: SEPARATE, stroke: '#8a9097', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }),
    )
    parts.push(iconSvg('bicycle', cx - 7, roadY + ROAD_H / 2 - 7, 14, '#5d646d', false))
    return el('g', { class: 'osml-cycleway osml-cycleway-separate' }, parts)
  }
  parts.push(el('rect', { x: round(sx), y: roadY, width: w, height: ROAD_H, fill: cw.type === 'track' ? CYCLE_TRACK : CYCLE_LANE }))
  if (cw.type === 'lane') {
    // outer road edge line on the cycle lane's outer side
    const ex = strip.screenSide === 'left' ? sx + 3 : sx + w - 3
    parts.push(lineSvg(ex, roadY, ROAD_H, 'solid'))
  }
  const icon = 16
  parts.push(iconSvg('bicycle', cx - icon / 2, roadY + ROAD_H - icon - 10, icon, '#fff', false))
  parts.push(stripArrows(cx, roadY + ROAD_H - icon - 22, 62, strip.arrows))
  return el('g', { class: `osml-cycleway osml-cycleway-${cw.type}` }, parts)
}

/** Line between the carriageway and a cycle lane: solid (exclusive), dashed (advisory) or none. */
function cycleLaneLine(strip: EdgeStrip, boundaryX: number, roadY: number): string {
  const lane = strip.cycleway.lane
  if (lane === 'pictogram') return ''
  const attrs =
    lane === 'advisory'
      ? { stroke: LINE, 'stroke-width': 2, 'stroke-dasharray': '10 8' }
      : { stroke: LINE, 'stroke-width': 4 }
  return el('line', { x1: round(boundaryX), y1: roadY, x2: round(boundaryX), y2: roadY + ROAD_H, ...attrs })
}

/** Bicycle pictogram with chevrons ("sharrow") in a lane shared with bicycles. */
function sharedSvg(m: SharedMarking, laneWidth: number, roadY: number, locale: Locale, labels: RenderOptions['labels']): string {
  const c = m.column
  const cx = c.x + laneWidth / 2
  const icon = 18
  const top = c.placeholder ? roadY + ROAD_H / 2 - 22 : c.rotated ? roadY + ROAD_H - 54 : roadY + 10
  const parts = [el('title', {}, esc(label(locale, cyclewayLabelKey(m.cycleway), labels)))]
  const iconY = c.rotated ? top : top + 18
  parts.push(iconSvg('bicycle', cx - icon / 2, iconY, icon, '#fff', false))
  // two chevrons ahead of the bicycle in the lane's direction of travel
  const chevron = (y: number, dir: number) =>
    `M${round(cx - 7)} ${round(y + 4 * dir)}L${round(cx)} ${round(y)}L${round(cx + 7)} ${round(y + 4 * dir)}`
  const d = c.rotated
    ? chevron(top + icon + 10, -1) + chevron(top + icon + 17, -1)
    : chevron(top + 2, 1) + chevron(top + 9, 1)
  parts.push(el('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
  return el('g', { class: `osml-cycleway osml-cycleway-${m.cycleway.type}` }, parts)
}

function legendSvg(lines: string[], y: number): string {
  return lines
    .map((l, i) => text({ x: MARGIN, y: y + 14 + i * 15, 'font-size': 11, 'font-family': 'sans-serif', fill: '#333' }, l))
    .join('')
}

/** Renders the lane graphic as an SVG string, or '' when the way has no lanes to draw. */
export function renderLanesSvg(input: LanesInput, options: RenderOptions = {}): string {
  const road = toRoadLanes(input, options)
  const { locale = 'en', showSigns = true, idPrefix = 'osml', laneWidth = 64 } = options
  const lay = layout(road, options)
  const { cols, strips } = lay
  if (!cols.length) return ''
  const leftStrip = strips.find((s) => s.screenSide === 'left')
  const rightStrip = strips.find((s) => s.screenSide === 'right')

  const defs = new SignDefs(idPrefix)
  const signsPerCol = cols.map((c) => (showSigns ? laneSigns(c.lane) : []))
  const signRows = Math.min(2, Math.max(0, ...signsPerCol.map((s) => Math.ceil(s.length / 2))))
  const widths = cols.map((c) => c.lane.width)
  const hasWidth = widths.some(Boolean) || strips.some((s) => s.cycleway.width)

  const top = signRows ? signRows * SIGN_ROW + 6 : 0
  const roadY = MARGIN + top
  const width = lay.width
  let height = roadY + ROAD_H + (hasWidth ? 18 : 0) + MARGIN

  const body: string[] = []
  // lane surfaces
  for (const c of cols) {
    body.push(el('rect', { x: c.x, y: roadY, width: laneWidth, height: ROAD_H, fill: laneTint(c.lane) }))
  }
  // edge lines and separators
  const first = cols[0]!
  const last = cols[cols.length - 1]!
  // Cycle strips first, so the line between carriageway and cycle lane stays on top.
  for (const strip of strips) body.push(stripSvg(strip, roadY, locale, options.labels))
  // A cycle lane takes the road edge line to its own outer side (drawn with the strip).
  if (leftStrip?.cycleway.type === 'lane') body.push(cycleLaneLine(leftStrip, first.x, roadY))
  else body.push(lineSvg(first.x + 3, roadY, ROAD_H, 'solid'))
  if (rightStrip?.cycleway.type === 'lane') body.push(cycleLaneLine(rightStrip, last.x + laneWidth, roadY))
  else body.push(lineSvg(last.x + laneWidth - 3, roadY, ROAD_H, 'solid'))
  for (const m of lay.shared) if (m.cycleway.type === 'shared_lane') body.push(sharedSvg(m, laneWidth, roadY, locale, options.labels))
  if (first.placeholder) {
    body.push(text({ x: round(first.x + laneWidth / 2), y: roadY + ROAD_H - 12, 'text-anchor': 'middle', 'font-size': 8, 'font-family': 'sans-serif', fill: '#c9cdd1' }, label(locale, 'lanes.untagged', options.labels)))
  }
  for (let i = 1; i < cols.length; i++) {
    body.push(lineSvg(cols[i]!.x, roadY, ROAD_H, separator(cols[i - 1]!, cols[i]!, road)))
  }

  cols.forEach((c, i) => {
    const cx = c.x + laneWidth / 2
    const chips = laneChips(c.lane)
    // A bus lane shared with bicycles shows the bicycle next to the bus icon.
    if (lay.shared.some((m) => m.column === c && m.cycleway.type === 'share_busway') && !chips.some((ch) => ch.mode === 'bicycle')) {
      chips.push({ mode: 'bicycle', value: 'designated' })
    }
    // arrow: foot at the bottom of the arrow area
    const footY = roadY + ROAD_H - (chips.length ? 44 : 22)
    const arrow = arrowSvg(c.lane.turn, 0, 0, { leftHandTraffic: options.drivingSide === 'left' })
    if (arrow) {
      const transform = c.rotated
        ? `translate(${round(cx)} ${round(roadY + ROAD_H - footY + roadY)}) rotate(180)`
        : `translate(${round(cx)} ${round(footY)})`
      body.push(el('g', { transform }, arrow))
    }
    // access icons (always upright), centred in a row near the bottom (top for rotated lanes)
    if (chips.length) {
      const shown = chips.slice(0, 2)
      const gap = 4
      const total = shown.length * ICON + (shown.length - 1) * gap
      const iy = c.rotated ? roadY + 10 : roadY + ROAD_H - ICON - 10
      shown.forEach((chip, k) => {
        const ix = cx - total / 2 + k * (ICON + gap)
        body.push(iconSvg(iconFor(chip.mode), ix, iy, ICON, '#fff', chip.value === 'no'))
      })
      if (chips.length > shown.length) {
        body.push(text({ x: round(c.x + laneWidth - 6), y: iy + ICON, 'text-anchor': 'end', 'font-size': 10, fill: '#fff', 'font-family': 'sans-serif' }, `+${chips.length - shown.length}`))
      }
    }
    // signs above the road
    const signs = signsPerCol[i]!.slice(0, signRows * 2)
    signs.forEach((s, k) => {
      const row = Math.floor(k / 2)
      const inRow = Math.min(2, signs.length - row * 2)
      const sx = inRow === 1 ? cx : cx + (k % 2 === 0 ? -15 : 15)
      const sy = MARGIN + row * SIGN_ROW + SIGN / 2
      body.push(defs.place(s, sx, sy, SIGN))
    })
    if (hasWidth && widths[i]) {
      const w = widths[i]!
      body.push(text({ x: cx, y: roadY + ROAD_H + 13, 'text-anchor': 'middle', 'font-size': 10, 'font-family': 'sans-serif', fill: '#333' }, metres(w)))
    }
  })
  for (const s of strips) {
    if (s.cycleway.width) {
      body.push(text({ x: round(s.x + s.width / 2), y: roadY + ROAD_H + 13, 'text-anchor': 'middle', 'font-size': 9, 'font-family': 'sans-serif', fill: '#333' }, metres(s.cycleway.width)))
    }
  }

  if (options.legend) {
    const lines = getLanesLegend(road, { locale, labels: options.labels }).map((e) => e.label)
    body.push(legendSvg(lines, height - MARGIN))
    height += lines.length * 15 + 6
  }

  const aria = options.ariaLabel ?? (first.placeholder ? label(locale, 'lanes', options.labels) : `${label(locale, 'lanes', options.labels)}: ${cols.length}`)
  const d = defs.defs()
  return el(
    'svg',
    {
      xmlns: options.standalone ? SVG_NS : undefined,
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: 'img',
      'aria-label': aria,
      class: options.className ?? 'osml-lanes',
    },
    [el('title', {}, esc(aria)), d ? el('defs', {}, d) : '', ...body],
  )
}

/** Renders the lane graphic as a DOM element (browser only), or null when there is nothing to draw. */
export function renderLanesElement(input: LanesInput, options: RenderOptions = {}): SVGSVGElement | null {
  return toElement(renderLanesSvg(input, { ...options, standalone: true }))
}
