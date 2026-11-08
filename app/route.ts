// Way selection lives in the query string (`?way=<id>`), so every deep link is served by
// GitHub Pages as the regular index.html with HTTP 200 — no 404 fallback page needed.
// The map position lives in the URL hash (MapLibre `hash`).

const PARAM = 'way'

export function wayIdFromLocation(loc: Location = window.location): string | null {
  const id = new URLSearchParams(loc.search).get(PARAM)?.trim() ?? ''
  return /^[1-9]\d{0,15}$/.test(id) ? id : null
}

/** Pushes (or replaces) the URL for a way, or the plain page URL for `null`. Keeps the hash. */
export function navigateToWay(id: string | null, replace = false) {
  const params = new URLSearchParams(window.location.search)
  if (id) params.set(PARAM, id)
  else params.delete(PARAM)
  const query = params.toString()
  const url = window.location.pathname + (query ? `?${query}` : '') + window.location.hash
  if (url === window.location.pathname + window.location.search + window.location.hash) return
  if (replace) history.replaceState(null, '', url)
  else history.pushState(null, '', url)
}
