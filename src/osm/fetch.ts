// Fetches a single OSM way (tags + geometry), either from an Overpass API instance or from the
// main OSM API v0.6.
//
// Overpass is the read-only interface to OSM data. Please respect the usage policy of the
// instance you use. The default, overpass-api.de, is operated by FOSSGIS e.V.; its terms are at
// https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/ — in short: identify
// your application, keep request volumes low (no bulk downloads), show the OSM attribution,
// and preferably make the endpoint configurable rather than hard-coding it.
//
// The OSM API (api.openstreetmap.org) answers single-element lookups much faster, but it is
// primarily the editing API. Its usage policy (https://operations.osmfoundation.org/policies/api/)
// asks for low volumes, an identifying User-Agent outside browsers, a valid Referer in browsers,
// and no bulk or read-only mass use. Use it for occasional, user-triggered lookups only.

import { OsmHttpError, OsmNotFoundError, OsmParseError, OsmRateLimitedError, OsmTimeoutError } from './errors'
import { parseOsmApiJson, parseOsmApiWays, parseOverpassJson } from './parse'
import type { BBox, OsmWay } from './types'

export const DEFAULT_OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
export const DEFAULT_OSM_API_BASE_URL = 'https://api.openstreetmap.org'

/** Upper bound for a response (a single way, or a small `/map` box). */
const MAX_BODY_BYTES = 4 * 1024 * 1024
/** 509 = OSM API bandwidth limit exceeded. */
const RETRY_STATUS = new Set([429, 502, 503, 504, 509])

interface CommonOptions {
  /** Custom fetch implementation (tests, Node < 18, proxies). Defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch
  signal?: AbortSignal
  /** Per-attempt timeout in milliseconds. */
  timeoutMs?: number
  /** Retries on 429/502/503/504/509 with exponential backoff (default 2). */
  retries?: number
  /** Initial backoff in milliseconds, doubled per retry (default 1 000). */
  backoffMs?: number
  /**
   * Extra request headers. Browsers do not allow setting User-Agent; outside the browser,
   * pass one that identifies your application, e.g. `{ 'User-Agent': 'my-app/1.0 (contact)' }`.
   */
  headers?: Record<string, string>
}

export interface FetchWayOptions extends CommonOptions {
  /** Overpass interpreter URL. Defaults to DEFAULT_OVERPASS_ENDPOINT. */
  endpoint?: string
  /**
   * Per-attempt timeout in milliseconds (default 60 000). Busy Overpass servers queue requests,
   * so the wall-clock time can exceed the query's own 25 s server-side timeout.
   */
  timeoutMs?: number
}

export interface FetchWayFromOsmApiOptions extends CommonOptions {
  /** OSM API base URL without `/api/0.6`. Defaults to DEFAULT_OSM_API_BASE_URL. */
  baseUrl?: string
  /** Per-attempt timeout in milliseconds (default 15 000). */
  timeoutMs?: number
}

/** Builds the Overpass QL query for one way with tags and node geometry. */
export function overpassWayQuery(id: string): string {
  return `[out:json][timeout:25];way(${id});out tags geom;`
}

/** Builds the OSM API v0.6 URL for one way with all its nodes. */
export function osmApiWayUrl(id: string, baseUrl = DEFAULT_OSM_API_BASE_URL): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/0.6/way/${id}/full.json`
}

function normaliseId(id: string | number): string {
  const s = String(id).trim()
  if (!/^[1-9]\d{0,15}$/.test(s)) throw new RangeError(`Invalid OSM way ID: ${String(id)}`)
  return s
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })

async function readCapped(res: Response): Promise<string> {
  const len = Number(res.headers.get('content-length') ?? '0')
  if (len > MAX_BODY_BYTES) throw new OsmParseError(`Response too large (${len} bytes)`)
  const text = await res.text()
  if (text.length > MAX_BODY_BYTES) throw new OsmParseError('Response too large')
  return text
}

/** One JSON request with timeout, retries/backoff and the shared error mapping. */
async function requestJson(
  url: string,
  init: RequestInit,
  /** Way ID for OsmNotFoundError on 404/410; without it those statuses are OsmHttpErrors. */
  wayId: string | undefined,
  options: CommonOptions & { timeoutMs: number },
): Promise<unknown> {
  const {
    fetch: doFetch = globalThis.fetch.bind(globalThis),
    signal,
    timeoutMs,
    retries = 2,
    backoffMs = 1_000,
  } = options

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController()
    const onAbort = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', onAbort, { once: true })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException('Timeout', 'TimeoutError'))
    }, timeoutMs)
    let res: Response
    try {
      res = await doFetch(url, { ...init, signal: controller.signal })
    } catch (err) {
      if (timedOut) throw new OsmTimeoutError(timeoutMs)
      throw err
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }

    if (res.ok) {
      const text = await readCapped(res)
      try {
        return JSON.parse(text)
      } catch {
        throw new OsmParseError('Server returned invalid JSON')
      }
    }
    if (RETRY_STATUS.has(res.status)) {
      if (attempt >= retries) throw new OsmRateLimitedError(res.status)
      await sleep(backoffMs * 2 ** attempt, signal)
      continue
    }
    if (wayId && (res.status === 404 || res.status === 410)) throw new OsmNotFoundError('way', wayId)
    const text = (await res.text().catch(() => '')).slice(0, 512)
    throw new OsmHttpError(res.status, text)
  }
}

/**
 * Fetches one OSM way by ID from Overpass.
 *
 * @throws RangeError for an invalid ID
 * @throws OsmNotFoundError when the way does not exist
 * @throws OsmRateLimitedError when the server stays busy after all retries
 * @throws OsmTimeoutError when an attempt gets no answer within `timeoutMs`
 * @throws OsmHttpError / OsmParseError for other failures
 */
export async function fetchWay(id: string | number, options: FetchWayOptions = {}): Promise<OsmWay> {
  const wayId = normaliseId(id)
  const { endpoint = DEFAULT_OVERPASS_ENDPOINT, timeoutMs = 60_000, headers = {} } = options
  const json = await requestJson(
    endpoint,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        ...headers,
      },
      body: new URLSearchParams({ data: overpassWayQuery(wayId) }).toString(),
    },
    wayId,
    { ...options, timeoutMs },
  )
  return parseOverpassJson(json, wayId)
}

/**
 * Fetches one OSM way by ID from the OSM API v0.6 (`/api/0.6/way/{id}/full.json`). Much faster
 * than a busy Overpass instance, but subject to the OSMF API usage policy (see above): only for
 * occasional, user-triggered lookups. Deleted ways (HTTP 410) raise OsmNotFoundError.
 *
 * @throws the same errors as fetchWay
 */
export async function fetchWayFromOsmApi(
  id: string | number,
  options: FetchWayFromOsmApiOptions = {},
): Promise<OsmWay> {
  const wayId = normaliseId(id)
  const { baseUrl = DEFAULT_OSM_API_BASE_URL, timeoutMs = 15_000, headers = {} } = options
  const json = await requestJson(
    osmApiWayUrl(wayId, baseUrl),
    { method: 'GET', headers: { Accept: 'application/json', ...headers } },
    wayId,
    { ...options, timeoutMs },
  )
  return parseOsmApiJson(json, wayId)
}

export interface FetchWaysInBboxOptions extends CommonOptions {
  /** OSM API base URL without `/api/0.6`. Defaults to DEFAULT_OSM_API_BASE_URL. */
  baseUrl?: string
  /** Per-attempt timeout in milliseconds (default 15 000). */
  timeoutMs?: number
}

/**
 * Largest box fetchWaysInBbox accepts, in square degrees (about 390 m × 390 m at 52° N).
 * The OSM API itself allows 0.25 deg², but `/map` returns *everything* in the box, so
 * keep the boxes small.
 */
export const MAX_BBOX_AREA = 0.00002

/** Builds the OSM API v0.6 URL for all data in a bounding box. */
export function osmApiMapUrl(bbox: BBox, baseUrl = DEFAULT_OSM_API_BASE_URL): string {
  const f = (n: number) => String(Math.round(n * 1e7) / 1e7)
  return `${baseUrl.replace(/\/+$/, '')}/api/0.6/map.json?bbox=${f(bbox.minlon)},${f(bbox.minlat)},${f(bbox.maxlon)},${f(bbox.maxlat)}`
}

/**
 * Fetches all ways in a small bounding box from the OSM API v0.6 (`/api/0.6/map`), with tags and
 * full geometry. The API returns the ways that have **at least one node inside the box** — a way
 * that only crosses the box between two of its nodes is not included.
 *
 * Subject to the OSMF API usage policy: only for occasional, user-triggered lookups.
 *
 * @throws RangeError for an invalid box or one larger than MAX_BBOX_AREA
 * @throws the same errors as fetchWay (except OsmNotFoundError)
 */
export async function fetchWaysInBbox(bbox: BBox, options: FetchWaysInBboxOptions = {}): Promise<OsmWay[]> {
  const { minlat, minlon, maxlat, maxlon } = bbox
  if (
    ![minlat, minlon, maxlat, maxlon].every(Number.isFinite) ||
    minlat >= maxlat ||
    minlon >= maxlon ||
    minlat < -90 ||
    maxlat > 90 ||
    minlon < -180 ||
    maxlon > 180
  ) {
    throw new RangeError('Invalid bounding box')
  }
  if ((maxlat - minlat) * (maxlon - minlon) > MAX_BBOX_AREA) throw new RangeError('Bounding box too large')
  const { baseUrl = DEFAULT_OSM_API_BASE_URL, timeoutMs = 15_000, headers = {} } = options
  const json = await requestJson(
    osmApiMapUrl(bbox, baseUrl),
    { method: 'GET', headers: { Accept: 'application/json', ...headers } },
    undefined,
    { ...options, timeoutMs },
  )
  return parseOsmApiWays(json)
}
