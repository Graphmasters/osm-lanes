# osm-lanes

Interpret the lane tagging of an [OpenStreetMap](https://www.openstreetmap.org/) way —
`lanes`, `turn:lanes`, `change:lanes`, `bus:lanes`, `maxspeed:lanes`, `destination:lanes`, … —
and render it as SVG: a **lane diagram** and, where `destination:lanes` is tagged, a
**destination sign** whose panels line up with the lanes.

**Demo:** <https://graphmasters.github.io/osm-lanes/> — zoom in, click a road, and the way's lanes
appear in the side panel. Every way has its own URL, e.g.
`https://graphmasters.github.io/osm-lanes/?way=26580967`.

> [!NOTE]
> The code in this repository was generated with [Claude](https://www.anthropic.com/claude)
> (Anthropic) under human direction and review.

## Features

- **Library** (TypeScript, zero runtime dependencies, ESM/CJS/IIFE builds):
  - `interpretLanes(tags)`: a pure function that turns OSM tags into a normalised lane model with
    explained warnings for inconsistent or unknown tagging.
  - `renderLanesSvg()` / `renderDestinationSignSvg()`: SVG strings (or DOM elements) with turn
    arrows, lane lines, access icons and German road signs (StVO).
  - `fetchWayFromOsmApi(id)` / `fetchWay(id)`: one way with tags and geometry from the OSM API v0.6
    or from an Overpass API instance.
  - `decodeTileFeatureId()`: OSM way IDs from vector-tile feature IDs (OpenFreeMap/planetiler
    encoding).
  - `wayBearing()` / `renderCompassSvg()`: the average compass bearing of a way and a compass rose
    showing it, to tell which way the lane diagram (drawn in way direction) points.
- **Demo app** (GitHub Pages): a MapLibre map with the Graphmasters
  [basemap.world](https://graphmasters.github.io/basemap-world-openfreemap/) style on OpenFreeMap tiles. Click a road to
  see its lane diagram, destination sign, notes and raw tags (each tag linked to its OSM wiki page).
  The selected way is highlighted with arrows in its drawing direction, and a compass rose next to
  the lane diagram shows the way's average bearing — the lane diagram's "up".

## Library usage

```sh
npm install osm-lanes
```

```ts
import { fetchWayFromOsmApi, interpretLanes, renderLanesSvg, renderDestinationSignSvg } from 'osm-lanes'

// From tags you already have …
const svg = renderLanesSvg({
  highway: 'primary',
  oneway: 'yes',
  lanes: '3',
  'turn:lanes': 'left|through|through;right',
  'bus:lanes': '||designated',
})

// … or fetch a way (see "Data sources" for the usage policies).
const way = await fetchWayFromOsmApi(26580967)
// or from Overpass: await fetchWay(26580967, { endpoint: 'https://overpass-api.de/api/interpreter' })
const road = interpretLanes(way.tags)
console.log(road.forward.map((lane) => lane.turn), road.warnings)
document.body.insertAdjacentHTML('beforeend', renderDestinationSignSvg(road) + renderLanesSvg(road))
```

| Function | Returns |
|---|---|
| `interpretLanes(tags)` | `RoadLanes`: `forward`, `backward` and `bothWays` lanes (left to right as seen by their drivers), `cycleways` (`left` / `right`), `oneway`, road-level values and `warnings`. |
| `renderLanesSvg(input, options?)` | SVG string, or `''` if the way has no lanes. `input` may be tags, an `OsmWay` or a `RoadLanes`. |
| `renderLanesElement(input, options?)` | `SVGSVGElement \| null` (browser). |
| `renderDestinationSignSvg(input, options?)` | SVG string, or `''` without `destination:lanes`. Uses the same column layout as the lane diagram. |
| `renderDestinationSignElement(input, options?)` | `SVGSVGElement \| null` (browser). |
| `getLanesLegend(road, { locale })` | Legend entries for the symbols in a diagram (`en`, `de`). |
| `fetchWayFromOsmApi(id, options?)` | `Promise<OsmWay>` from `/api/0.6/way/{id}/full.json` (tags, geometry, bounds, last edit, version). Option `baseUrl`. |
| `fetchWay(id, options?)` | `Promise<OsmWay>` from Overpass (tags, geometry, bounds, data timestamp). Option `endpoint`. Both fetchers throw `OsmNotFoundError`, `OsmRateLimitedError`, `OsmTimeoutError`, … |
| `wayBearing(geometry)` | Average bearing of a way's geometry in drawing direction (degrees clockwise from north, length-weighted circular mean), or `null` for fewer than two nodes or ways that loop back on themselves. |
| `renderCompassSvg(bearing, options?)` / `renderCompassElement(…)` | Compass rose (north up) with an arrow to `bearing` and the bearing as text (`47° NE`), or `''` / `null` without a bearing. Options `locale`, `size`, `labels`, … |
| `decodeTileFeatureId(id)` | `{ kind: 'element', type, id }`, `{ kind: 'merged', hintWayId }` or `{ kind: 'invalid' }`. |
| `SUPPORTED_TAGS`, `wikiUrlForKey(key)` | Supported keys and their OSM wiki pages. |

Render options: `direction` (`both` \| `forward` \| `backward`), `drivingSide` (`right` \| `left`),
`laneWidth`, `showSigns`, `legend`, `locale`, `labels`, `ariaLabel`, `className`, `standalone`,
`idPrefix`. All tag values are escaped, so the output is safe to insert into HTML.

The IIFE build exposes a global `OsmLanes` for `<script>` use:
`https://unpkg.com/osm-lanes/dist/index.global.js`.

## Supported tags

Lane values are read according to the
[lanes general extension](https://wiki.openstreetmap.org/wiki/Lanes): one value per lane,
separated by `|`, listed left to right in each lane's direction of travel. `:forward` lanes travel
in the way's direction and `:backward` lanes against it, and an empty entry falls back to the key
without `:lanes`. A `*` below means the `:forward` / `:backward` / `:both_ways` suffixes are
supported too.

| Key | Meaning |
|---|---|
| [`lanes`](https://wiki.openstreetmap.org/wiki/Key:lanes) | Number of lanes for motorised traffic. |
| [`lanes:forward / lanes:backward`](https://wiki.openstreetmap.org/wiki/Key:lanes) | Lanes per direction on two-way roads. |
| [`lanes:both_ways`](https://wiki.openstreetmap.org/wiki/Key:lanes:both_ways) | Centre lanes usable from both directions (e.g. a two-way turn lane). |
| [`oneway`](https://wiki.openstreetmap.org/wiki/Key:oneway) | One-way roads, including oneway=-1. |
| [`turn:lanes*`](https://wiki.openstreetmap.org/wiki/Key:turn) | Turn indications per lane (left, through, right, merge_to_left, …). |
| [`change:lanes*`](https://wiki.openstreetmap.org/wiki/Key:change) | Whether lane changes are allowed (solid vs dashed lines). |
| [`access:lanes*`](https://wiki.openstreetmap.org/wiki/Key:access) | General access per lane. |
| [`motor_vehicle:lanes*`](https://wiki.openstreetmap.org/wiki/Key:access) | Motor-vehicle access per lane. |
| [`hgv:lanes*`](https://wiki.openstreetmap.org/wiki/Key:hgv) | Heavy goods vehicle access per lane. |
| [`bus:lanes*`](https://wiki.openstreetmap.org/wiki/Key:bus:lanes) | Bus access per lane (bus lanes). |
| [`psv:lanes*`](https://wiki.openstreetmap.org/wiki/Key:psv:lanes) | Public service vehicle access per lane. |
| [`taxi:lanes*`](https://wiki.openstreetmap.org/wiki/Key:taxi) | Taxi access per lane. |
| [`hov:lanes*`](https://wiki.openstreetmap.org/wiki/Key:hov) | High-occupancy vehicle access per lane. |
| [`bicycle:lanes*`](https://wiki.openstreetmap.org/wiki/Key:bicycle) | Bicycle access per lane. |
| [`maxspeed:lanes*`](https://wiki.openstreetmap.org/wiki/Key:maxspeed) | Speed limit per lane. |
| [`minspeed:lanes*`](https://wiki.openstreetmap.org/wiki/Key:minspeed) | Minimum speed per lane. |
| [`width:lanes*`](https://wiki.openstreetmap.org/wiki/Key:width) | Physical width per lane. |
| [`maxheight:lanes*`](https://wiki.openstreetmap.org/wiki/Key:maxheight) | Height limit per lane. |
| [`maxweight:lanes*`](https://wiki.openstreetmap.org/wiki/Key:maxweight) | Weight limit per lane. |
| [`destination:lanes*`](https://wiki.openstreetmap.org/wiki/Key:destination) | Signposted destinations per lane. |
| [`destination:ref:lanes*`](https://wiki.openstreetmap.org/wiki/Key:destination:ref) | Signposted route numbers per lane. |
| [`destination:symbol:lanes*`](https://wiki.openstreetmap.org/wiki/Key:destination:symbol) | Signposted symbols (airport, …) per lane. |
| [`destination:colour:lanes*`](https://wiki.openstreetmap.org/wiki/Key:destination:colour) | Background colour of the destination sign per lane. |
| [`overtaking`](https://wiki.openstreetmap.org/wiki/Key:overtaking) | Overtaking prohibition (solid centre line). |
| [`cycleway / cycleway:both / cycleway:left / cycleway:right`](https://wiki.openstreetmap.org/wiki/Key:cycleway) | Cycle lanes, cycle tracks, shared lanes and separately mapped cycleways beside the carriageway. |
| [`cycleway:*:lane`](https://wiki.openstreetmap.org/wiki/Key:cycleway:lane) | Kind of cycle lane: exclusive (solid line), advisory (dashed line) or pictogram. |
| [`cycleway:*:oneway`](https://wiki.openstreetmap.org/wiki/Key:oneway) | Direction of a cycle lane or track (yes, -1, no), e.g. contraflow lanes. |
| [`cycleway:*:width`](https://wiki.openstreetmap.org/wiki/Key:width) | Width of a cycle lane or track. |

Cycleways are drawn at the road's edges: a cycle lane as a red strip on the carriageway (solid
line for `exclusive`, dashed for `advisory`), a cycle track as a strip behind a kerb, a cycleway
mapped as a separate way as a dashed outline, and `shared_lane` / `share_busway` as a bicycle
pictogram in the outermost lane. `left` and `right` are relative to the way's direction. A plain
`cycleway=*` applies to both sides of a two-way road and to the right side of a one-way road. If a
road has cycleway tags but no lane tags, the carriageway is drawn as one unmarked block.

Not interpreted yet, and reported as notes: `placement`, `cycleway:lanes`, `*:lanes:conditional`
and the count-style `lanes:psv` / `lanes:bus`.

## How way selection works in the demo

OpenFreeMap's vector tiles (built with planetiler, OpenMapTiles schema) encode the source OSM
element in each feature ID as `osmId × 10 + type` (1 = node, 2 = way, 3 = relation). The demo reads
that ID from the clicked road feature and fetches that way. Planetiler **merges** adjacent road
segments with identical map attributes into one feature (type digit `0`); such a feature keeps only
the ID of the first merged way, which is often not the segment under the pointer. The demo
therefore only lets you select features that stand for exactly one way:

- Below zoom 14 almost every road feature is merged, so selection starts at zoom 14 (the tiles'
  maximum zoom; higher zoom levels only enlarge them).
- At zoom 14 and above, merged features (roughly a quarter of the roads) are not clickable.

## Data sources and usage policies

- **OSM API v0.6.** `fetchWayFromOsmApi` defaults to `https://api.openstreetmap.org`, operated by the
  OpenStreetMap Foundation under its [API usage policy](https://operations.osmfoundation.org/policies/api/).
  It is primarily the editing API: use it only for occasional, user-triggered lookups (no bulk or
  automated reading), send a valid `Referer` (browsers do) or an identifying `User-Agent` (outside
  browsers), and show the OSM attribution.
- **Overpass API.** `fetchWay` defaults to `https://overpass-api.de/api/interpreter`, operated by
  FOSSGIS e.V. under their
  [terms of use](https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/). In short:
  low request volumes only (no bulk downloads), visible OSM attribution, a contact address, and a
  configurable endpoint. If you build on this library, **please pass your own `endpoint`**; outside
  browsers, also send a `User-Agent` that identifies your application.
- **The demo** loads a way from the OSM API first, because a busy public Overpass instance can take
  30 s or more to answer, and falls back to Overpass when the API is busy or unreachable. It
  requests a way only on an explicit click or deep link, caches results per session, keeps at most
  one request in flight and backs off when a server is busy. Both endpoints can be changed at build
  time with `VITE_OSM_API_BASE_URL` and `VITE_OVERPASS_ENDPOINT`.
- **Tiles and map style.** Vector tiles from [OpenFreeMap](https://openfreemap.org/) (OpenMapTiles
  schema), styled with the Graphmasters
  [basemap.world](https://graphmasters.github.io/basemap-world-openfreemap/) style
  (`https://graphmasters.github.io/basemap-world-openfreemap/style.json`), an adaptation of the
  basemap.de design (© GeoBasis-DE / BKG, CC BY 4.0). Its credits appear in the map's attribution
  control.
- **Data.** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Found an
  error in the map? [Report or fix it](https://www.openstreetmap.org/fixthemap).

## Development

```sh
npm ci
npm test            # vitest
npm run typecheck
npm run build       # library → dist/
npm run dev         # demo app (Vite) at http://localhost:5173/osm-lanes/
npm run build:app   # demo → _site/
```

Third-party graphics are regenerated with `npm run fetch-stvo` (downloads the public-domain sign
SVGs from Wikimedia Commons and checks their licence templates) and `npm run assets` (inlines Pinhead
icons and the signs into `src/svg/`). The generated files are committed.

## Inspiration

This project was inspired by [OsmLaneVisualizer](https://github.com/mueschel/OsmLaneVisualizer) by
mueschel, a long-standing tool for checking lane tagging. **osm-lanes is a separate, independent
implementation.** It contains no code, styles, images or other material from OsmLaneVisualizer,
which is published under CC BY-NC-SA (incompatible with Apache-2.0), and it is not affiliated with
that project.

## Licence

The source code is licensed under the [Apache License 2.0](LICENSE).

Included third-party material keeps its own terms (details in [ATTRIBUTION.md](ATTRIBUTION.md)):

- icons from [Pinhead](https://github.com/waysidemapping/pinhead): CC0 1.0
- German road signs (StVO) from Wikimedia Commons: public domain as official works (§ 5 UrhG)
- map data: © OpenStreetMap contributors, ODbL (not bundled; loaded at runtime by the demo)

## Contact

Questions, bugs and ideas: [GitHub issues](https://github.com/Graphmasters/osm-lanes/issues).
Publisher and legal contact: [Graphmasters imprint](https://www.graphmasters.net/imprint).
