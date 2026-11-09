// Which OSM ways count as streets — the ways lane tags are about. Footways, cycleways, paths,
// pedestrian areas, steps and tracks rarely carry lane information; cycle lanes and tracks that
// are tagged on the street (cycleway=*) are covered by the street itself.

/** `highway=*` values of streets (including `_link` roads). */
export const STREET_HIGHWAYS: ReadonlySet<string> = new Set([
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'road',
  'busway',
])

/** True for streets: `highway` in STREET_HIGHWAYS, or a street under construction. */
export function isStreet(tags: Readonly<Record<string, string>>): boolean {
  const highway = tags['highway']
  if (!highway) return false
  if (highway === 'construction') return STREET_HIGHWAYS.has(tags['construction'] ?? '')
  return STREET_HIGHWAYS.has(highway)
}
