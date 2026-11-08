import type { MapGeoJSONFeature } from 'maplibre-gl'
import { decodeTileFeatureId } from '../src/index'
import { createMap } from './map'
import { cancelPending, loadWay } from './overpass'
import { Panel } from './panel'
import { navigateToWay, wayIdFromLocation } from './route'
import './style.css'

const hint = document.getElementById('hint')!
const panel = new Panel(document.getElementById('panel')!, {
  onClose: () => {
    navigateToWay(null)
    render(false)
  },
  onRetry: () => render(false),
})

/** Notice shown for the current selection (e.g. merged tile features); cleared on navigation. */
let notice: string | undefined

const roadMap = createMap(document.getElementById('map')!, onSelect, (tooLow) => {
  hint.textContent = tooLow ? 'Zoom in further to select a road.' : 'Click a road to see its lanes.'
  hint.classList.toggle('warn', tooLow)
})

function onSelect(feature: MapGeoJSONFeature) {
  const decoded = decodeTileFeatureId(feature.id)
  notice = undefined
  if (decoded.kind === 'invalid') {
    hint.textContent = 'This map feature has no usable OpenStreetMap ID.'
    return
  }
  if (decoded.kind === 'element' && decoded.type !== 'way') {
    hint.textContent = `This is an OpenStreetMap ${decoded.type}, not a way.`
    return
  }
  const id = decoded.kind === 'merged' ? decoded.hintWayId : decoded.id
  if (decoded.kind === 'merged') {
    notice = `This map segment was merged from several OSM ways in the vector tiles; showing way ${id}, which may differ from the segment you clicked (see the highlighted line).`
  }
  navigateToWay(id)
  render(false)
}

let renderSeq = 0
async function render(fit: boolean) {
  const id = wayIdFromLocation()
  const seq = ++renderSeq
  if (!id) {
    cancelPending()
    notice = undefined
    panel.close()
    roadMap.showWay(null, false)
    return
  }
  const currentNotice = notice
  panel.loading(id, currentNotice)
  roadMap.showWay(null, false)
  try {
    const way = await loadWay(id)
    if (seq !== renderSeq) return
    panel.way(way, currentNotice)
    roadMap.showWay(way, fit)
  } catch (err) {
    if (seq !== renderSeq || (err instanceof DOMException && err.name === 'AbortError')) return
    panel.error(id, err, currentNotice)
  }
}

window.addEventListener('popstate', () => {
  notice = undefined
  render(true)
})

// Deep link (?way=<id>): load the way and fit the map to it.
render(true)
