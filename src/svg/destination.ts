// Renders the destination sign (destination:lanes and friends) as a separate graphic whose
// lane columns line up with the lane graphic. Consecutive lanes with the same destinations
// share one panel, as on real lane-specific direction signs.

import { hasDestinations, type Lane, type RoadLanes } from '../lanes/model'
import { el, esc, round, text, toElement, SVG_NS } from './el'
import { ICONS } from './icons'
import { label, type Locale } from './labels'
import { columns, MARGIN, toRoadLanes, type Column, type LanesInput, type LayoutOptions } from './layout'

export interface DestinationSignOptions extends LayoutOptions {
  ariaLabel?: string
  className?: string
  locale?: Locale
  labels?: Partial<Record<string, string>>
  standalone?: boolean
}

const FONT = 'Arial Narrow, Roboto Condensed, Arial, Helvetica, sans-serif'
const LINE_H = 13
const SHIELD_H = 15
const SYMBOL = 16
const ARROW_H = 14
const CHAR_W = 5.6

/** Common OSM destination:colour names → hex. Other valid CSS colours are passed through. */
const NAMED: Record<string, string> = {
  blue: '#1d5ca8',
  green: '#2d7d46',
  yellow: '#f7c600',
  white: '#ffffff',
  brown: '#7a4a28',
  red: '#c1121c',
  orange: '#e8781e',
  black: '#111111',
  grey: '#8a8f96',
  gray: '#8a8f96',
}

function luminance(hex: string): number {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.slice(0, 6)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function panelColours(colour: string | undefined, highway: string | undefined) {
  let bg: string | undefined
  if (colour) {
    const c = colour.trim().toLowerCase()
    if (NAMED[c]) bg = NAMED[c]
    else if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(c)) bg = c
  }
  if (!bg) {
    // Default German scheme: motorway signs are blue, other through roads yellow.
    bg = highway === 'motorway' || highway === 'motorway_link' ? NAMED.blue! : NAMED.yellow!
  }
  const fg = luminance(bg) > 0.5 ? '#111111' : '#ffffff'
  return { bg, fg, border: bg === '#ffffff' ? '#111111' : fg }
}

function shieldStyle(ref: string) {
  const r = ref.trim()
  if (/^A\s?\d/i.test(r)) return { bg: NAMED.blue!, fg: '#fff', border: '#fff' }
  if (/^B\s?\d/i.test(r)) return { bg: NAMED.yellow!, fg: '#111', border: '#111' }
  if (/^E\s?\d/i.test(r)) return { bg: NAMED.green!, fg: '#fff', border: '#fff' }
  return { bg: '#fff', fg: '#111', border: '#111' }
}

/**
 * Greedy word wrap with hyphen/slash breaks; at most `maxLines` lines. A single word longer than
 * `maxChars` is kept whole up to `hardMax` characters (the renderer condenses it, as real signs
 * do) and cut with an ellipsis beyond that.
 */
export function wrap(value: string, maxChars: number, maxLines = 3, hardMax = Math.floor(maxChars * 1.4)): string[] {
  const words = value.split(/(?<=[-/])|\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const sep = cur === '' || /[-/]$/.test(cur) ? '' : ' '
    if ((cur + sep + w).length <= maxChars) cur += sep + w
    else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  const cut = (l: string) => (l.length > hardMax ? l.slice(0, Math.max(1, hardMax - 1)) + '…' : l)
  const out = lines.map(cut)
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines)
    kept[maxLines - 1] = cut(kept[maxLines - 1]! + '…')
    return kept
  }
  return out
}

interface Group {
  cols: Column[]
  lane: Lane
}

const signature = (l: Lane) =>
  JSON.stringify([l.direction, l.destination, l.destinationRef, l.destinationSymbol, l.destinationColour])

const hasData = (l: Lane) => !!(l.destination?.length || l.destinationRef?.length || l.destinationSymbol?.length)

function groups(cols: Column[]): Group[] {
  const out: Group[] = []
  for (const c of cols) {
    if (!hasData(c.lane)) continue
    const prev = out[out.length - 1]
    const prevCol = prev?.cols[prev.cols.length - 1]
    if (prev && prevCol && cols.indexOf(prevCol) === cols.indexOf(c) - 1 && signature(prev.lane) === signature(c.lane)) {
      prev.cols.push(c)
    } else {
      out.push({ cols: [c], lane: c.lane })
    }
  }
  return out
}

interface Laid {
  height: number
  draw: (y: number, h: number) => string
}

function layoutPanel(g: Group, laneWidth: number, highway: string | undefined): Laid {
  const x = g.cols[0]!.x + 2
  const w = g.cols.length * laneWidth - 4
  const inner = w - 8
  const { bg, fg, border } = panelColours(g.lane.destinationColour, highway)
  const items: { h: number; draw: (y: number) => string }[] = []

  // route shields, flowing into rows
  const refs = g.lane.destinationRef ?? []
  if (refs.length) {
    const rows: { ref: string; w: number }[][] = [[]]
    let used = 0
    for (const ref of refs) {
      const sw = Math.min(inner, 8 + ref.length * 6)
      if (used && used + 3 + sw > inner) {
        rows.push([])
        used = 0
      }
      rows[rows.length - 1]!.push({ ref, w: sw })
      used += (used ? 3 : 0) + sw
    }
    for (const row of rows) {
      items.push({
        h: SHIELD_H + 3,
        draw: (y) => {
          const total = row.reduce((s, r) => s + r.w, 0) + (row.length - 1) * 3
          let sx = x + w / 2 - total / 2
          return row
            .map((r) => {
              const st = shieldStyle(r.ref)
              const maxChars = Math.floor((r.w - 4) / 6)
              const label = r.ref.length > maxChars ? r.ref.slice(0, Math.max(1, maxChars - 1)) + '…' : r.ref
              const svg =
                el('rect', { x: round(sx), y, width: round(r.w), height: SHIELD_H, rx: 3, fill: st.bg, stroke: st.border, 'stroke-width': 1.2 }) +
                text({ x: round(sx + r.w / 2), y: y + 11.5, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 700, 'font-family': FONT, fill: st.fg }, label)
              sx += r.w + 3
              return svg
            })
            .join('')
        },
      })
    }
  }

  // symbols (Pinhead icons where available, otherwise the raw value as text)
  const symbols = g.lane.destinationSymbol ?? []
  if (symbols.length) {
    items.push({
      h: SYMBOL + 3,
      draw: (y) => {
        const perRow = Math.max(1, Math.floor(inner / (SYMBOL + 3)))
        const shown = symbols.slice(0, perRow)
        const total = shown.length * SYMBOL + (shown.length - 1) * 3
        return shown
          .map((s, k) => {
            const sx = x + w / 2 - total / 2 + k * (SYMBOL + 3)
            const icon = ICONS[s]
            const title = el('title', {}, esc(s))
            if (!icon) {
              return el('g', {}, [title, text({ x: round(sx + SYMBOL / 2), y: y + 12, 'text-anchor': 'middle', 'font-size': 8, 'font-family': FONT, fill: fg }, s.slice(0, 4))])
            }
            return el('g', {}, [title, el('path', { d: icon.d, fill: fg, transform: `translate(${round(sx)} ${y}) scale(${round(SYMBOL / 15)})` })])
          })
          .join('')
      },
    })
  }

  // destination names
  const maxChars = Math.max(3, Math.floor(inner / CHAR_W))
  for (const dest of g.lane.destination ?? []) {
    for (const line of wrap(dest, maxChars)) {
      items.push({
        h: LINE_H,
        draw: (y) =>
          text(
            {
              x: round(x + w / 2),
              y: y + 10,
              'text-anchor': 'middle',
              'font-size': 11,
              'font-family': FONT,
              fill: fg,
              // condense lines that are estimated to be wider than the panel
              textLength: line.length * CHAR_W > inner ? inner : undefined,
              lengthAdjust: line.length * CHAR_W > inner ? 'spacingAndGlyphs' : undefined,
            },
            line,
          ),
      })
    }
  }

  const contentH = items.reduce((s, i) => s + i.h, 0)
  return {
    height: contentH + ARROW_H + 10,
    draw: (y, h) => {
      const parts = [el('rect', { x, y, width: w, height: h, rx: 4, fill: bg, stroke: border, 'stroke-width': 1.5 })]
      let cy = y + 5
      for (const it of items) {
        parts.push(it.draw(cy))
        cy += it.h
      }
      // one down-arrow per lane, pointing at the lane below
      for (const c of g.cols) {
        const ax = c.x + laneWidth / 2
        const ay = y + h - ARROW_H - 3
        parts.push(
          el('path', {
            d: `M${round(ax)} ${round(ay)}V${round(ay + ARROW_H - 6)}M${round(ax - 4.5)} ${round(ay + ARROW_H - 8)}L${round(ax)} ${round(ay + ARROW_H - 2)}L${round(ax + 4.5)} ${round(ay + ARROW_H - 8)}`,
            fill: 'none',
            stroke: fg,
            'stroke-width': 2,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          }),
        )
      }
      return el('g', { class: 'osml-destination-panel' }, parts)
    },
  }
}

/**
 * Renders the destination sign as an SVG string, or '' when no lane carries destination
 * information. Columns use the same layout (and options) as renderLanesSvg.
 */
export function renderDestinationSignSvg(input: LanesInput, options: DestinationSignOptions = {}): string {
  const road: RoadLanes = toRoadLanes(input)
  if (!hasDestinations(road)) return ''
  const { laneWidth = 64, locale = 'en' } = options
  const cols = columns(road, options)
  const gs = groups(cols)
  if (!gs.length) return ''
  const laid = gs.map((g) => layoutPanel(g, laneWidth, road.road.highway))
  const panelH = Math.max(...laid.map((l) => l.height))
  const width = MARGIN * 2 + cols.length * laneWidth
  const height = MARGIN * 2 + panelH
  const aria = options.ariaLabel ?? label(locale, 'destinations', options.labels)
  return el(
    'svg',
    {
      xmlns: options.standalone ? SVG_NS : undefined,
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: 'img',
      'aria-label': aria,
      class: options.className ?? 'osml-destinations',
    },
    [el('title', {}, esc(aria)), ...laid.map((l) => l.draw(MARGIN, panelH))],
  )
}

/** DOM variant of renderDestinationSignSvg (browser only). */
export function renderDestinationSignElement(
  input: LanesInput,
  options: DestinationSignOptions = {},
): SVGSVGElement | null {
  return toElement(renderDestinationSignSvg(input, { ...options, standalone: true }))
}
