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
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number }
  /** Timestamp of the OSM data the answer is based on (Overpass `osm3s.timestamp_osm_base`). */
  dataTimestamp?: string
}
