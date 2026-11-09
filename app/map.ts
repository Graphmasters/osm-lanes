// MapLibre map with the Graphmasters basemap.world style (basemap.de design on OpenFreeMap tiles). Road features of the `transportation`
// source layer are hoverable/clickable; their tile feature ID encodes the OSM way ID.
// Features that planetiler merged from several ways (ID suffix 0) are not selectable: their ID
// names only the first merged way, which is often not the segment under the pointer.

import maplibregl, { type GeoJSONSource, type MapGeoJSONFeature } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { decodeTileFeatureId, type LatLon, type OsmWay } from '../src/index'

export const STYLE_URL = 'https://graphmasters.github.io/basemap-world-openfreemap/style.json'
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
const DIRECTION_ICON = 'osml-direction'

/**
 * A chevron pointing right (+x), drawn on a canvas so no sprite or glyph from the style is
 * needed. Symbols placed along a line turn their +x axis into the line direction, so the
 * chevrons point in the way's drawing direction.
 */
function directionIcon(): ImageData {
  const px = 48
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.canvas.width = ctx.canvas.height = px
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const chevron = () => {
    ctx.beginPath()
    ctx.moveTo(px * 0.32, px * 0.18)
    ctx.lineTo(px * 0.68, px * 0.5)
    ctx.lineTo(px * 0.32, px * 0.82)
    ctx.stroke()
  }
  ctx.strokeStyle = '#7a2e05'
  ctx.lineWidth = px * 0.26
  chevron()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = px * 0.14
  chevron()
  return ctx.getImageData(0, 0, px, px)
}

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
  // Work that needs the highlight layers, queued until they exist. Not `map.loaded()`: that is
  // false whenever any source is still loading (also right after setData), and the `load` event
  // fires only once — waiting for it then would drop the highlight for good.
  let ready = false
  const pending: (() => void)[] = []
  const whenReady = (fn: () => void) => (ready ? fn() : pending.push(fn))

  map.on('load', () => {
    // All line layers of the OpenMapTiles `transportation` layer; railways and other non-road
    // classes are filtered out per feature (SELECTABLE_CLASSES). The source name differs between
    // styles, so it is taken from the style itself.
    const transport = map
      .getStyle()
      .layers.filter((l) => l.type === 'line' && 'source-layer' in l && l['source-layer'] === 'transportation')
    roadLayers = transport.map((l) => l.id)
    const tileSource = transport[0] && 'source' in transport[0] ? transport[0].source : 'openmaptiles'

    map.addLayer({
      id: HOVER_LAYER,
      type: 'line',
      source: tileSource,
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
    // Chevrons along the highlight show the way's drawing direction (the lane graphic's "up").
    if (!map.hasImage(DIRECTION_ICON)) map.addImage(DIRECTION_ICON, directionIcon(), { pixelRatio: 2 })
    map.addLayer({
      id: `${SELECTED_SOURCE}-direction`,
      type: 'symbol',
      source: SELECTED_SOURCE,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 14, 70, 18, 140],
        'icon-image': DIRECTION_ICON,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.7, 18, 1.3],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    })
    onZoomHint(map.getZoom() < MIN_SELECT_ZOOM)
    ready = true
    for (const fn of pending.splice(0)) fn()
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

  return {
    map,
    showWay(way, fit) {
      whenReady(() => {
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
