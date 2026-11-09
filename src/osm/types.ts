export type OsmElementType = 'node' | 'way' | 'relation'

export interface LatLon {
  lat: number
  lon: number
}

export interface OsmWay {
  type: 'way'
  /** OSM way ID as a decimal string (IDs are kept as strings throughout). */
  id: string
  tags: Record<string, string>
  /** Node coordinates in way order, when the source returned geometry. */
  geometry?: LatLon[]
  bounds?: BBox
  /** Timestamp of the OSM data the answer is based on (Overpass `osm3s.timestamp_osm_base`). */
  dataTimestamp?: string
  /** Time of the way's last edit (OSM API only; Overpass `out tags geom` has no metadata). */
  timestamp?: string
  /** Version of the way (OSM API only). */
  version?: number
  /** Where the way was loaded from. */
  source?: OsmWaySource
}

export type OsmWaySource = 'overpass' | 'osm-api'

export interface BBox {
  minlat: number
  minlon: number
  maxlat: number
  maxlon: number
}
