// Compass rose showing a bearing — used next to the lane graphic, whose "up" is the way
// direction, to tell which compass direction that is.

import { el, esc, round, text, toElement, SVG_NS } from './el'
import { label, type Locale } from './labels'

export interface CompassOptions {
  ariaLabel?: string
  className?: string
  locale?: Locale
  labels?: Partial<Record<string, string>>
  standalone?: boolean
  /** Outer size in pixels (default 76). */
  size?: number
}

const POINTS = {
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  de: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
} as const

const ARROW = '#e8590c'
const RING = '#5d646d'

/** Eight-wind compass point for a bearing in degrees (e.g. 47 → `NE`, or `NO` in German). */
export function compassPoint(bearing: number, locale: Locale = 'en'): string {
  const i = Math.round((((bearing % 360) + 360) % 360) / 45) % 8
  return (POINTS[locale] ?? POINTS.en)[i]!
}

/**
 * Renders a compass rose (north up) with an arrow pointing to `bearing` (degrees clockwise from
 * north) and the bearing as text underneath. Returns '' for a missing or non-finite bearing.
 */
export function renderCompassSvg(bearing: number | null | undefined, options: CompassOptions = {}): string {
  if (bearing === null || bearing === undefined || !Number.isFinite(bearing)) return ''
  const { locale = 'en', size = 76 } = options
  const b = ((bearing % 360) + 360) % 360
  const deg = Math.round(b) % 360
  const point = compassPoint(b, locale)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 3
  const height = size + 18

  const body: string[] = []
  body.push(el('circle', { cx, cy, r, fill: '#fff', stroke: RING, 'stroke-width': 1.5 }))
  // ticks every 45°, longer at the cardinal points
  for (let a = 0; a < 360; a += 45) {
    const len = a % 90 === 0 ? 7 : 4
    const rad = (a * Math.PI) / 180
    const sx = Math.sin(rad)
    const sy = -Math.cos(rad)
    body.push(
      el('line', {
        x1: round(cx + sx * r),
        y1: round(cy + sy * r),
        x2: round(cx + sx * (r - len)),
        y2: round(cy + sy * (r - len)),
        stroke: RING,
        'stroke-width': 1.5,
      }),
    )
  }
  // cardinal letters
  const letters = POINTS[locale] ?? POINTS.en
  const lr = r - 14
  ;[0, 2, 4, 6].forEach((i) => {
    const rad = (i * 45 * Math.PI) / 180
    body.push(
      text(
        {
          x: round(cx + Math.sin(rad) * lr),
          y: round(cy - Math.cos(rad) * lr + 3.5),
          'text-anchor': 'middle',
          'font-size': 10,
          'font-weight': i === 0 ? 700 : 400,
          'font-family': 'sans-serif',
          fill: i === 0 ? '#b3261e' : RING,
        },
        letters[i]!,
      ),
    )
  })
  // direction arrow: tail at the centre's far side, head towards the bearing
  const head = r - 4
  const tail = r - 22
  body.push(
    el('g', { transform: `translate(${cx} ${cy}) rotate(${round(b)})` }, [
      el('line', { x1: 0, y1: tail, x2: 0, y2: -head + 9, stroke: ARROW, 'stroke-width': 3, 'stroke-linecap': 'round' }),
      el('path', { d: `M0 ${-head} L6 ${-head + 11} L-6 ${-head + 11} Z`, fill: ARROW }),
      el('circle', { cx: 0, cy: 0, r: 2.5, fill: ARROW }),
    ]),
  )
  body.push(
    text(
      { x: cx, y: size + 13, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'sans-serif', fill: '#333' },
      `${deg}° ${point}`,
    ),
  )

  const aria = options.ariaLabel ?? `${label(locale, 'compass', options.labels)}: ${deg}° (${point})`
  return el(
    'svg',
    {
      xmlns: options.standalone ? SVG_NS : undefined,
      viewBox: `0 0 ${size} ${height}`,
      width: size,
      height,
      role: 'img',
      'aria-label': aria,
      class: options.className ?? 'osml-compass',
    },
    [el('title', {}, esc(aria)), ...body],
  )
}

/** Renders the compass as a DOM element (browser only), or null when there is no bearing. */
export function renderCompassElement(bearing: number | null | undefined, options: CompassOptions = {}): SVGSVGElement | null {
  return toElement(renderCompassSvg(bearing, { ...options, standalone: true }))
}
