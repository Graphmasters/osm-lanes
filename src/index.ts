// osm-lanes — interpret OpenStreetMap lane tags and render them as SVG.

// data access
export {
  fetchWay,
  fetchWayFromOsmApi,
  overpassWayQuery,
  osmApiWayUrl,
  DEFAULT_OVERPASS_ENDPOINT,
  DEFAULT_OSM_API_BASE_URL,
  type FetchWayOptions,
  type FetchWayFromOsmApiOptions,
} from './osm/fetch'
export { parseOverpassJson, parseOsmApiJson } from './osm/parse'
export { decodeTileFeatureId, type DecodedFeatureId } from './osm/tile-id'
export {
  OsmError,
  OsmNotFoundError,
  OsmRateLimitedError,
  OsmHttpError,
  OsmParseError,
  OsmTimeoutError,
} from './osm/errors'
export { wayBearing } from './osm/bearing'
export type { OsmWay, OsmWaySource, OsmElementType, LatLon } from './osm/types'

// interpretation
export { interpretLanes, type Tags } from './lanes/interpret'
export {
  cyclewayDirection,
  hasCycleways,
  type Cycleway,
  type CyclewaySide,
  type CyclewayType,
  type RoadCycleways,
} from './lanes/cycleway'
export {
  TURN_VALUES,
  ACCESS_MODES,
  totalLanes,
  hasDestinations,
  type Lane,
  type LaneDirection,
  type LaneWarning,
  type RoadLanes,
  type TurnValue,
  type AccessMode,
  type WarningCode,
} from './lanes/model'
export { SUPPORTED_TAGS, LANES_WIKI_URL, wikiUrlForKey, type SupportedTag } from './lanes/tags'

// rendering
export { renderLanesSvg, renderLanesElement, type RenderOptions } from './svg/render'
export {
  renderDestinationSignSvg,
  renderDestinationSignElement,
  type DestinationSignOptions,
} from './svg/destination'
export { renderCompassSvg, renderCompassElement, compassPoint, type CompassOptions } from './svg/compass'
export { getLanesLegend, type LegendEntry, type LegendOptions } from './svg/legend'
export { LABELS, type Locale } from './svg/labels'
export type { LanesInput, LayoutOptions } from './svg/layout'
