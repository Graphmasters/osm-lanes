import type { MapGeoJSONFeature } from 'maplibre-gl'
import { decodeTileFeatureId } from '../src/index'
import { createMap } from './map'
import { cancelPending, findStreetsAt, loadWay } from './way-source'
import { Panel } from './panel'
import type { LatLon } from '../src/index'
import { navigateToWay, wayIdFromLocation } from './route'
import './style.css'

const hint = document.getElementById('hint')!
const panel = new Panel(document.getElementById('panel')!, {
  onClose: () => {
    navigateToWay(null)
    render(false)
  },
  onRetry: () => render(false),
  onPick: (id) => {
    navigateToWay(id)
    render(false)
  },
})

const roadMap = createMap(document.getElementById('map')!, onSelect, (tooLow) => {
  hint.textContent = tooLow ? 'Zoom in further to select a street.' : 'Click a street to see its lanes.'
  hint.classList.toggle('warn', tooLow)
})

function onSelect(feature: MapGeoJSONFeature, at: LatLon) {
  const decoded = decodeTileFeatureId(feature.id)
  if (decoded.kind === 'element' && decoded.type === 'way') {
    navigateToWay(decoded.id)
    render(false)
  } else if (decoded.kind === 'merged') {
    pickAt(at, decoded.hintWayId)
  }
}

let renderSeq = 0

/**
 * A merged tile feature names only its first way, so the streets at the clicked point are looked
 * up (one OSM API request) and offered as a list; the nearest one is shown right away.
 */
async function pickAt(at: LatLon, hintWayId: string) {
  const seq = ++renderSeq
  panel.choices = null
  roadMap.showCandidates([])
  roadMap.showWay(null, false)
  panel.searching()
  try {
    const streets = await findStreetsAt(at)
    if (seq !== renderSeq) return
    panel.choices = { streets, hintWayId }
    roadMap.showCandidates(streets.map((s) => s.way))
    const nearest = streets[0]
    if (nearest) {
      navigateToWay(nearest.way.id)
      render(false)
    } else {
      navigateToWay(null)
      panel.noStreets()
    }
  } catch (err) {
    if (seq !== renderSeq || (err instanceof DOMException && err.name === 'AbortError')) return
    panel.searchError(err)
  }
}

/** Keeps the list of streets only while the selected way is one of them. */
function syncChoices(id: string | null) {
  const c = panel.choices
  if (c && id && (c.hintWayId === id || c.streets.some((s) => s.way.id === id))) return
  panel.choices = null
  roadMap.showCandidates([])
}

async function render(fit: boolean) {
  const id = wayIdFromLocation()
  const seq = ++renderSeq
  syncChoices(id)
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
