// Helpers for the `|` / `;` value syntax of the OSM lanes general extension
// (https://wiki.openstreetmap.org/wiki/Lanes).

/** Splits a `:lanes` value into per-lane entries. `'a||b'` → `['a', '', 'b']`. */
export function splitLanes(value: string): string[] {
  return value.split('|').map((v) => v.trim())
}

/** Splits a multi-value entry. `'left;through'` → `['left', 'through']`; empty → `[]`. */
export function splitMulti(value: string): string[] {
  return value
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

/** Parses a positive integer lane count; returns undefined for missing or invalid values. */
export function parseCount(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const v = value.trim()
  if (!/^\d+$/.test(v)) return undefined
  return Number(v)
}
