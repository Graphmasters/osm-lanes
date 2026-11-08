// Minimal string-based SVG builder. All attribute values and text nodes are escaped, because
// OSM tag values are arbitrary user input.

export function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type Attrs = Record<string, string | number | undefined | null | false>

/** Builds an element. `children` must already be markup (use `esc` for text). */
export function el(tag: string, attrs: Attrs = {}, children: string | string[] = ''): string {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${esc(typeof v === 'number' ? round(v) : (v as string))}"`)
    .join('')
  const body = Array.isArray(children) ? children.join('') : children
  return body === '' ? `<${tag}${a}/>` : `<${tag}${a}>${body}</${tag}>`
}

/** Text element with escaped content. */
export const text = (attrs: Attrs, content: string) => el('text', attrs, esc(content))

/** Rounds to 2 decimals to keep the markup small and deterministic. */
export const round = (n: number) => Math.round(n * 100) / 100

/** Parses an SVG string into an element (browser only). */
export function toElement(svg: string): SVGSVGElement | null {
  if (!svg || typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  if (root.nodeName !== 'svg') return null
  return (typeof document !== 'undefined' ? document.importNode(root, true) : root) as unknown as SVGSVGElement
}

export const SVG_NS = 'http://www.w3.org/2000/svg'
