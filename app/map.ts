// MapLibre map with the OpenFreeMap "liberty" style. Road features of the `transportation`
// source layer are hoverable/clickable; their tile feature ID encodes the OSM way ID.
// Features that planetiler merged from several ways (ID suffix 0) are not selectable: their ID
// names only the first merged way, which is often not the segment under the pointer.

import maplibregl, { type GeoJSONSource, type MapGeoJSONFeature } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { decodeTileFeatureId, type LatLon, type OsmWay } from '../src/index'

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
/** Below this zoom most tile features are merged from several ways, so selection is disabled. */
export const MIN_SELECT_ZOOM = 14

/** OpenMapTiles `transportation` classes that represent ways usable by road traffic or people. */
const SELECTABLE_CLASSES = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'minor',
  'service',
  'track',
  'path',
  'busway',
  'bus_guideway',
  'raceway',
  'motorway_construction',
  'trunk_construction',
  'primary_construction',
  'secondary_construction',
  'tertiary_construction',
  'minor_construction',
  'service_construction',
  'track_construction',
  'path_construction',
])

/** True when a tile feature ID encodes exactly one OSM way (not a merged feature). */
function isSingleWay(id: MapGeoJSONFeature['id']): boolean {
  const d = decodeTileFeatureId(id)
  return d.kind === 'element' && d.type === 'way'
}

const HOVER_LAYER = 'osml-hover'
const SELECTED_SOURCE = 'osml-selected'

export interface RoadMap {
  map: maplibregl.Map
  showWay(way: OsmWay | null, fit: boolean): void
}

export function createMap(
  container: HTMLElement,
  onSelect: (feature: MapGeoJSONFeature) => void,
  onZoomHint: (tooLow: boolean) => void,
): RoadMap {
  const map = new maplibregl.Map({
    container,
    style: STYLE_URL,
    center: [9.7386, 52.3745],
    zoom: 15,
    hash: 'map',
    attributionControl: {
      compact: window.matchMedia('(max-width: 640px)').matches,
      // Map data credits (OpenFreeMap, OpenMapTiles, OpenStreetMap) come from the tile source.
      customAttribution:
        '<a href="https://www.graphmasters.net/imprint" target="_blank" rel="noopener noreferrer">Impressum</a>',
    },
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

  let roadLayers: string[] = []

  map.on('load', () => {
    roadLayers = map
      .getStyle()
      .layers.filter(
        (l) => l.type === 'line' && 'source-layer' in l && l['source-layer'] === 'transportation' && !/rail/.test(l.id),
      )
      .map((l) => l.id)

    map.addLayer({
      id: HOVER_LAYER,
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', ['id'], -1],
      paint: { 'line-color': '#1a73e8', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 4, 18, 14], 'line-opacity': 0.45 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    })
    map.addSource(SELECTED_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: `${SELECTED_SOURCE}-casing`,
      type: 'line',
      source: SELECTED_SOURCE,
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 8, 18, 20] },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    })
    map.addLayer({
      id: SELECTED_SOURCE,
      type: 'line',
      source: SELECTED_SOURCE,
      paint: { 'line-color': '#e8590c', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 4, 18, 12] },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    })
    onZoomHint(map.getZoom() < MIN_SELECT_ZOOM)
  })

  const roadAt = (point: maplibregl.PointLike): MapGeoJSONFeature | undefined => {
    if (!roadLayers.length) return undefined
    const p = maplibregl.Point.convert(point)
    const box: [maplibregl.PointLike, maplibregl.PointLike] = [
      [p.x - 4, p.y - 4],
      [p.x + 4, p.y + 4],
    ]
    return map
      .queryRenderedFeatures(box, { layers: roadLayers })
      .find((f) => SELECTABLE_CLASSES.has(String(f.properties['class'])) && isSingleWay(f.id))
  }

  let hoverId: number | string | undefined
  map.on('mousemove', (e) => {
    const f = map.getZoom() >= MIN_SELECT_ZOOM ? roadAt(e.point) : undefined
    map.getCanvas().style.cursor = f ? 'pointer' : ''
    if (f?.id !== hoverId) {
      hoverId = f?.id
      if (map.getLayer(HOVER_LAYER)) map.setFilter(HOVER_LAYER, ['==', ['id'], hoverId ?? -1])
    }
  })
  map.on('mouseout', () => {
    hoverId = undefined
    if (map.getLayer(HOVER_LAYER)) map.setFilter(HOVER_LAYER, ['==', ['id'], -1])
  })
  map.on('zoomend', () => onZoomHint(map.getZoom() < MIN_SELECT_ZOOM))
  map.on('click', (e) => {
    if (map.getZoom() < MIN_SELECT_ZOOM) {
      onZoomHint(true)
      return
    }
    const f = roadAt(e.point)
    if (f) onSelect(f)
  })

  const whenLoaded = (fn: () => void) => (map.loaded() && map.getSource(SELECTED_SOURCE) ? fn() : map.once('load', fn))

  return {
    map,
    showWay(way, fit) {
      whenLoaded(() => {
        const src = map.getSource(SELECTED_SOURCE) as GeoJSONSource | undefined
        const coords = (way?.geometry ?? []).map((p: LatLon) => [p.lon, p.lat])
        src?.setData({
          type: 'FeatureCollection',
          features: coords.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [],
        })
        if (fit && way?.bounds) {
          const b = way.bounds
          map.fitBounds(
            [
              [b.minlon, b.minlat],
              [b.maxlon, b.maxlat],
            ],
            { padding: { top: 60, bottom: 60, left: 60, right: window.innerWidth > 720 ? 440 : 60 }, maxZoom: 18, duration: 0 },
          )
          if (map.getZoom() < MIN_SELECT_ZOOM) map.setZoom(MIN_SELECT_ZOOM)
        }
      })
    },
  }
}
