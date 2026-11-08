// Registry of the OSM keys osm-lanes understands, with links to their documentation in the
// OpenStreetMap wiki. This is the single source for the README table and the demo's tag links.

const WIKI = 'https://wiki.openstreetmap.org/wiki/'

export interface SupportedTag {
  /** Key pattern; `*` stands for an optional `:forward` / `:backward` / `:both_ways` suffix. */
  key: string
  wikiUrl: string
  description: string
}

export const SUPPORTED_TAGS: readonly SupportedTag[] = [
  { key: 'lanes', wikiUrl: `${WIKI}Key:lanes`, description: 'Number of lanes for motorised traffic.' },
  { key: 'lanes:forward / lanes:backward', wikiUrl: `${WIKI}Key:lanes`, description: 'Lanes per direction on two-way roads.' },
  { key: 'lanes:both_ways', wikiUrl: `${WIKI}Key:lanes:both_ways`, description: 'Centre lanes usable from both directions (e.g. a two-way turn lane).' },
  { key: 'oneway', wikiUrl: `${WIKI}Key:oneway`, description: 'One-way roads, including oneway=-1.' },
  { key: 'turn:lanes*', wikiUrl: `${WIKI}Key:turn`, description: 'Turn indications per lane (left, through, right, merge_to_left, …).' },
  { key: 'change:lanes*', wikiUrl: `${WIKI}Key:change`, description: 'Whether lane changes are allowed (solid vs dashed lines).' },
  { key: 'access:lanes*', wikiUrl: `${WIKI}Key:access`, description: 'General access per lane.' },
  { key: 'motor_vehicle:lanes*', wikiUrl: `${WIKI}Key:access`, description: 'Motor-vehicle access per lane.' },
  { key: 'hgv:lanes*', wikiUrl: `${WIKI}Key:hgv`, description: 'Heavy goods vehicle access per lane.' },
  { key: 'bus:lanes*', wikiUrl: `${WIKI}Key:bus:lanes`, description: 'Bus access per lane (bus lanes).' },
  { key: 'psv:lanes*', wikiUrl: `${WIKI}Key:psv:lanes`, description: 'Public service vehicle access per lane.' },
  { key: 'taxi:lanes*', wikiUrl: `${WIKI}Key:taxi`, description: 'Taxi access per lane.' },
  { key: 'hov:lanes*', wikiUrl: `${WIKI}Key:hov`, description: 'High-occupancy vehicle access per lane.' },
  { key: 'bicycle:lanes*', wikiUrl: `${WIKI}Key:bicycle`, description: 'Bicycle access per lane.' },
  { key: 'maxspeed:lanes*', wikiUrl: `${WIKI}Key:maxspeed`, description: 'Speed limit per lane.' },
  { key: 'minspeed:lanes*', wikiUrl: `${WIKI}Key:minspeed`, description: 'Minimum speed per lane.' },
  { key: 'width:lanes*', wikiUrl: `${WIKI}Key:width`, description: 'Physical width per lane.' },
  { key: 'maxheight:lanes*', wikiUrl: `${WIKI}Key:maxheight`, description: 'Height limit per lane.' },
  { key: 'maxweight:lanes*', wikiUrl: `${WIKI}Key:maxweight`, description: 'Weight limit per lane.' },
  { key: 'destination:lanes*', wikiUrl: `${WIKI}Key:destination`, description: 'Signposted destinations per lane.' },
  { key: 'destination:ref:lanes*', wikiUrl: `${WIKI}Key:destination:ref`, description: 'Signposted route numbers per lane.' },
  { key: 'destination:symbol:lanes*', wikiUrl: `${WIKI}Key:destination:symbol`, description: 'Signposted symbols (airport, …) per lane.' },
  { key: 'destination:colour:lanes*', wikiUrl: `${WIKI}Key:destination:colour`, description: 'Background colour of the destination sign per lane.' },
  { key: 'overtaking', wikiUrl: `${WIKI}Key:overtaking`, description: 'Overtaking prohibition (solid centre line).' },
]

/** General documentation of the `:lanes` suffix and direction conventions. */
export const LANES_WIKI_URL = `${WIKI}Lanes`

/**
 * Returns the most specific OSM wiki page for a tag key, or undefined when the key is not
 * related to lanes. Used by the demo to link raw tags.
 */
export function wikiUrlForKey(key: string): string | undefined {
  const base = key
    .replace(/:(forward|backward|both_ways)$/, '')
    .replace(/:lanes(:.*)?$/, '')
    .replace(/:conditional$/, '')
  switch (base) {
    case 'lanes':
      return key.startsWith('lanes:both_ways') ? `${WIKI}Key:lanes:both_ways` : `${WIKI}Key:lanes`
    case 'turn':
    case 'change':
    case 'oneway':
    case 'overtaking':
    case 'maxspeed':
    case 'minspeed':
    case 'width':
    case 'maxheight':
    case 'maxweight':
    case 'maxwidth':
    case 'destination':
    case 'destination:ref':
    case 'destination:symbol':
    case 'destination:colour':
    case 'destination:arrow':
    case 'placement':
    case 'hgv':
    case 'hov':
    case 'taxi':
    case 'bicycle':
    case 'access':
    case 'motor_vehicle':
    case 'cycleway':
    case 'busway':
      return `${WIKI}Key:${base}`
    case 'bus':
      return key.includes(':lanes') ? `${WIKI}Key:bus:lanes` : `${WIKI}Key:bus`
    case 'psv':
      return key.includes(':lanes') ? `${WIKI}Key:psv:lanes` : `${WIKI}Key:psv`
    default:
      if (key.includes(':lanes')) return LANES_WIKI_URL
      return undefined
  }
}
