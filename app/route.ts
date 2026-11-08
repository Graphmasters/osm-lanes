// /way/<id> routing on top of the History API, aware of the deployment base path
// (/osm-lanes/ on GitHub Pages). The map position lives in the URL hash (MapLibre `hash`).

const BASE = import.meta.env.BASE_URL // always ends with '/'

export function wayIdFromLocation(loc: Location = window.location): string | null {
  const path = loc.pathname.startsWith(BASE) ? loc.pathname.slice(BASE.length) : ''
  const m = path.match(/^way\/([1-9]\d{0,15})\/?$/)
  return m ? m[1]! : null
}

/** Pushes (or replaces) the URL for a way, or the base URL for `null`. Keeps the hash. */
export function navigateToWay(id: string | null, replace = false) {
  const path = id ? `${BASE}way/${id}` : BASE
  if (window.location.pathname === path) return
  const url = path + window.location.search + window.location.hash
  if (replace) history.replaceState(null, '', url)
  else history.pushState(null, '', url)
}
