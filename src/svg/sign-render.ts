// Places StVO road signs. Signs with a Wikimedia Commons file (public domain, see signs.ts)
// are embedded once per document as <symbol> and referenced with <use>. Values without a
// matching file (e.g. a 45 km/h limit) are drawn as a simplified circular sign by osm-lanes.

import { el, esc, round } from './el'
import { SIGNS } from './signs'

export interface SignRef {
  /** Key in SIGNS (e.g. `274-50`) or a generic sign description. */
  key?: string
  generic?: { kind: 'prohibition' | 'mandatory'; label: string }
  title: string
}

const RED = '#c1121c'
const BLUE = '#1f5fa8'

function num(value: string): number | undefined {
  const m = value.trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*([a-z ]*)$/i)
  if (!m) return undefined
  return Number(m[1])
}

const fmt = (n: number) => String(Math.round(n * 10) / 10)

export function speedSign(value: string, min = false): SignRef | undefined {
  const v = value.trim()
  const n = num(v)
  if (n === undefined) return undefined
  const mph = /mph$/i.test(v)
  const key = `${min ? 275 : 274}-${n}`
  if (!mph && SIGNS[key]) return { key, title: v }
  return { generic: { kind: min ? 'mandatory' : 'prohibition', label: mph ? `${fmt(n)}mph` : fmt(n) }, title: v }
}

export function heightSign(value: string): SignRef | undefined {
  const n = num(value)
  if (n === undefined) return undefined
  const key = `265-${fmt(n)}`
  return SIGNS[key] ? { key, title: value } : { generic: { kind: 'prohibition', label: `${fmt(n)} m` }, title: value }
}

export function weightSign(value: string): SignRef | undefined {
  const n = num(value)
  if (n === undefined) return undefined
  const key = `262-${fmt(n)}`
  return SIGNS[key] ? { key, title: value } : { generic: { kind: 'prohibition', label: `${fmt(n)} t` }, title: value }
}

/** Collects the SIGNS keys used so they can be emitted as <symbol>s in <defs>. */
export class SignDefs {
  private used = new Set<string>()
  constructor(private prefix: string) {}

  id(key: string) {
    return `${this.prefix}-sign-${key.replace(/[^a-z0-9-]/gi, '_')}`
  }

  place(sign: SignRef, cx: number, cy: number, size: number): string {
    const title = el('title', {}, esc(sign.title))
    if (sign.key && SIGNS[sign.key]) {
      this.used.add(sign.key)
      return el('g', { class: 'osml-sign' }, [
        title,
        el('use', { href: `#${this.id(sign.key)}`, x: round(cx - size / 2), y: round(cy - size / 2), width: size, height: size }),
      ])
    }
    const g = sign.generic
    if (!g) return ''
    const r = size / 2
    const fontSize = Math.min(size * 0.42, (size * 1.5) / Math.max(2, g.label.length))
    const circle =
      g.kind === 'prohibition'
        ? [
            el('circle', { cx, cy, r: r - 0.5, fill: '#fff', stroke: '#fff', 'stroke-width': 1 }),
            el('circle', { cx, cy, r: r * 0.84, fill: '#fff', stroke: RED, 'stroke-width': r * 0.24 }),
          ]
        : [el('circle', { cx, cy, r: r - 0.5, fill: BLUE, stroke: '#fff', 'stroke-width': 1 })]
    return el('g', { class: 'osml-sign osml-sign-generic' }, [
      title,
      ...circle,
      el(
        'text',
        {
          x: cx,
          y: round(cy + fontSize * 0.36),
          'text-anchor': 'middle',
          'font-family': 'Arial, Helvetica, sans-serif',
          'font-weight': 700,
          'font-size': round(fontSize),
          fill: g.kind === 'prohibition' ? '#000' : '#fff',
        },
        esc(g.label),
      ),
    ])
  }

  defs(): string {
    return [...this.used]
      .sort()
      .map((key) => {
        const s = SIGNS[key]!
        return el('symbol', { id: this.id(key), viewBox: s.viewBox }, s.body)
      })
      .join('')
  }
}
