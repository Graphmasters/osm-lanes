// Turn arrows in the style of German direction-arrow road markings (StVO Zeichen 297),
// drawn from scratch as parametric paths so that any combination of OSM turn values can be
// composed into one arrow (e.g. `left;through`).
//
// Local frame: origin = foot of the arrow stem, y grows downwards, the arrow points "up"
// (towards negative y). Total height ≈ 86 units, width ≈ ±26.

import { el, round } from './el'

const STEM = 34
const HEAD_LEN = 13
const HEAD_W = 15

interface Branch {
  /** Path data of the shaft, ending at the base of the arrow head. */
  d: string
  /** End point (base of the head) and unit direction of travel there. */
  bx: number
  by: number
  ux: number
  uy: number
}

const norm = (x: number, y: number) => {
  const l = Math.hypot(x, y)
  return { ux: x / l, uy: y / l }
}

/** Left-hand variants; right-hand ones are mirrored. */
function leftBranch(kind: string): Branch | undefined {
  const s = -STEM
  switch (kind) {
    case 'through':
      return { d: `M0 ${s}L0 -73`, bx: 0, by: -73, ux: 0, uy: -1 }
    case 'slight_left': {
      const u = norm(-1, -2)
      return { d: `M0 ${s}L-13 ${s - 26}`, bx: -13, by: s - 26, ...u }
    }
    case 'left':
      return { d: `M0 ${s}Q0 ${s - 24} -13 ${s - 24}`, bx: -13, by: s - 24, ux: -1, uy: 0 }
    case 'sharp_left': {
      const u = norm(-12, 9)
      return { d: `M0 ${s}Q0 ${s - 24} -12 ${s - 15}`, bx: -12, by: s - 15, ...u }
    }
    case 'reverse':
      return {
        d: `M0 ${s}L0 ${s - 18}A10 10 0 0 0 -20 ${s - 18}L-20 ${s - 4}`,
        bx: -20,
        by: s - 4,
        ux: 0,
        uy: 1,
      }
    default:
      return undefined
  }
}

/** Mirrors x coordinates of a path built only from M/L/Q/A commands with absolute coordinates. */
function mirrorPath(d: string): string {
  const tokens = d.match(/[MLQA]|-?\d+(?:\.\d+)?/g) ?? []
  const out: string[] = []
  let cmd = ''
  let idx = 0
  for (const t of tokens) {
    if (/[MLQA]/.test(t)) {
      cmd = t
      idx = 0
      out.push(t)
      continue
    }
    let v = Number(t)
    if (cmd === 'A') {
      // rx ry rot large sweep x y
      const pos = idx % 7
      if (pos === 4) v = v === 0 ? 1 : 0 // flip sweep flag
      if (pos === 5) v = -v
    } else if (idx % 2 === 0) {
      v = -v
    }
    idx++
    out.push(String(v))
  }
  return out.join(' ')
}

function mirror(b: Branch): Branch {
  return { d: mirrorPath(b.d), bx: -b.bx, by: b.by, ux: -b.ux, uy: b.uy }
}

function branchFor(kind: string): Branch | undefined {
  if (kind.endsWith('right')) {
    const left = leftBranch(kind.replace(/right$/, 'left'))
    return left && mirror(left)
  }
  return leftBranch(kind)
}

function head(b: Branch): string {
  const tx = b.bx + b.ux * HEAD_LEN
  const ty = b.by + b.uy * HEAD_LEN
  const px = -b.uy * (HEAD_W / 2)
  const py = b.ux * (HEAD_W / 2)
  return `M${round(tx)} ${round(ty)}L${round(b.bx + px)} ${round(b.by + py)}L${round(b.bx - px)} ${round(b.by - py)}Z`
}

export const KNOWN_ARROWS = new Set([
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
])

/**
 * Returns the arrow markup for a list of turn values, positioned with its foot at (x, y).
 * `leftHandTraffic` mirrors U-turns (which turn across the oncoming traffic).
 */
export function arrowSvg(
  turns: readonly string[],
  x: number,
  y: number,
  opts: { colour?: string; leftHandTraffic?: boolean; scale?: number } = {},
): string {
  const colour = opts.colour ?? '#fff'
  const scale = opts.scale ?? 1
  const known = turns.filter((t) => KNOWN_ARROWS.has(t))
  const unknown = turns.filter((t) => !KNOWN_ARROWS.has(t))
  const shafts: string[] = []
  const heads: string[] = []

  const merge = known.find((t) => t.startsWith('merge_to_'))
  if (merge) {
    // A merge arrow is one bent arrow shifting to the side; drawn alone.
    const sign = merge === 'merge_to_left' ? -1 : 1
    const off = -sign * 9
    shafts.push(`M${off} 0L${off} -20C${off} -40 ${off + sign * 18} -44 ${off + sign * 18} -64`)
    heads.push(head({ d: '', bx: off + sign * 18, by: -64, ux: 0, uy: -1 }))
  } else if (known.length) {
    shafts.push(`M0 0L0 ${-STEM}`)
    for (const t of known) {
      const b =
        t === 'reverse' && opts.leftHandTraffic ? mirror(leftBranch('reverse')!) : branchFor(t)
      if (!b) continue
      shafts.push(b.d)
      heads.push(head(b))
    }
  }

  const parts: string[] = []
  if (shafts.length) {
    parts.push(el('path', { d: shafts.join(''), fill: 'none', stroke: colour, 'stroke-width': 6, 'stroke-linejoin': 'round' }))
    parts.push(el('path', { d: heads.join(''), fill: colour }))
  }
  if (unknown.length && !known.length) {
    parts.push(el('text', { x: 0, y: -36, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 700, fill: colour, 'font-family': 'sans-serif' }, '?'))
  }
  if (!parts.length) return ''
  const transform = `translate(${round(x)} ${round(y)})${scale !== 1 ? ` scale(${scale})` : ''}`
  return el('g', { transform, class: 'osml-arrow' }, parts)
}
