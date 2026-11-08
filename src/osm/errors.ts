/** Base class for all errors raised while fetching or parsing OSM data. */
export class OsmError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** The requested element does not exist (or has been deleted). */
export class OsmNotFoundError extends OsmError {
  constructor(
    readonly elementType: string,
    readonly id: string,
  ) {
    super(`${elementType} ${id} not found`)
  }
}

/** The server is rate limiting or over capacity (HTTP 429, 502, 503, 504). Retry later. */
export class OsmRateLimitedError extends OsmError {
  constructor(readonly status: number) {
    super(`OSM data server busy (HTTP ${status}); please retry later`)
  }
}

/** Any other unexpected HTTP status. */
export class OsmHttpError extends OsmError {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`OSM data request failed with HTTP ${status}`)
  }
}

/** The response could not be understood. */
export class OsmParseError extends OsmError {}

/** The server did not answer within the timeout (Overpass may queue requests when busy). */
export class OsmTimeoutError extends OsmError {
  constructor(readonly timeoutMs: number) {
    super(`No answer from the OSM data server within ${Math.round(timeoutMs / 1000)} s`)
  }
}
