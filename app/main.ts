import type { MapGeoJSONFeature } from 'maplibre-gl'
import { decodeTileFeatureId } from '../src/index'
import { createMap } from './map'
import { cancelPending, loadWay } from './way-source'
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

const roadMap = createMap(document.getElementById('map')!, onSelect, (tooLow) => {
  hint.textContent = tooLow ? 'Zoom in further to select a road.' : 'Click a road to see its lanes.'
  hint.classList.toggle('warn', tooLow)
})

function onSelect(feature: MapGeoJSONFeature) {
  // The map only offers features that decode to a single OSM way (see map.ts).
  const decoded = decodeTileFeatureId(feature.id)
  if (decoded.kind !== 'element' || decoded.type !== 'way') return
  navigateToWay(decoded.id)
  render(false)
}

let renderSeq = 0
async function render(fit: boolean) {
  const id = wayIdFromLocation()
  const seq = ++renderSeq
  if (!id) {
    cancelPending()
    panel.close()
    roadMap.showWay(null, false)
    return
  }
  panel.loading(id)
  roadMap.showWay(null, false)
  try {
    const way = await loadWay(id)
    if (seq !== renderSeq) return
    panel.way(way)
    roadMap.showWay(way, fit)
  } catch (err) {
    if (seq !== renderSeq || (err instanceof DOMException && err.name === 'AbortError')) return
    panel.error(id, err)
  }
}

window.addEventListener('popstate', () => render(true))

// Deep link (?way=<id>): load the way and fit the map to it.
render(true)
