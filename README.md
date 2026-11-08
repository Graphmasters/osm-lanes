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
  - `fetchWay(id)`: one way with tags and geometry from an Overpass API instance.
  - `decodeTileFeatureId()`: OSM way IDs from vector-tile feature IDs (OpenFreeMap/planetiler
    encoding).
- **Demo app** (GitHub Pages): a MapLibre map with the OpenFreeMap "Liberty" style. Click a road to
  see its lane diagram, destination sign, notes and raw tags (each tag linked to its OSM wiki page).

## Library usage

```sh
npm install @graphmasters/osm-lanes   # not yet published; use a pinned git dependency meanwhile
```

```ts
import { fetchWay, interpretLanes, renderLanesSvg, renderDestinationSignSvg } from '@graphmasters/osm-lanes'

// From tags you already have …
const svg = renderLanesSvg({
  highway: 'primary',
  oneway: 'yes',
  lanes: '3',
  'turn:lanes': 'left|through|through;right',
  'bus:lanes': '||designated',
})

// … or fetch a way from Overpass (please set your own endpoint, see "Data sources").
const way = await fetchWay(26580967, { endpoint: 'https://overpass-api.de/api/interpreter' })
const road = interpretLanes(way.tags)
console.log(road.forward.map((lane) => lane.turn), road.warnings)
document.body.insertAdjacentHTML('beforeend', renderDestinationSignSvg(road) + renderLanesSvg(road))
```

| Function | Returns |
|---|---|
| `interpretLanes(tags)` | `RoadLanes`: `forward`, `backward` and `bothWays` lanes (left to right as seen by their drivers), `oneway`, road-level values and `warnings`. |
| `renderLanesSvg(input, options?)` | SVG string, or `''` if the way has no lanes. `input` may be tags, an `OsmWay` or a `RoadLanes`. |
| `renderLanesElement(input, options?)` | `SVGSVGElement \| null` (browser). |
| `renderDestinationSignSvg(input, options?)` | SVG string, or `''` without `destination:lanes`. Uses the same column layout as the lane diagram. |
| `renderDestinationSignElement(input, options?)` | `SVGSVGElement \| null` (browser). |
| `getLanesLegend(road, { locale })` | Legend entries for the symbols in a diagram (`en`, `de`). |
| `fetchWay(id, options?)` | `Promise<OsmWay>` (tags, geometry, bounds, data timestamp). Throws `OsmNotFoundError`, `OsmRateLimitedError`, `OsmTimeoutError`, … |
| `decodeTileFeatureId(id)` | `{ kind: 'element', type, id }`, `{ kind: 'merged', hintWayId }` or `{ kind: 'invalid' }`. |
| `SUPPORTED_TAGS`, `wikiUrlForKey(key)` | Supported keys and their OSM wiki pages. |

Render options: `direction` (`both` \| `forward` \| `backward`), `drivingSide` (`right` \| `left`),
`laneWidth`, `showSigns`, `legend`, `locale`, `labels`, `ariaLabel`, `className`, `standalone`,
`idPrefix`. All tag values are escaped, so the output is safe to insert into HTML.

The IIFE build exposes a global `OsmLanes` for `<script>` use:
`https://unpkg.com/@graphmasters/osm-lanes/dist/index.global.js` (once published).

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

Not interpreted yet, and reported as notes: `placement`, `cycleway:*`, `*:lanes:conditional` and
the count-style `lanes:psv` / `lanes:bus`.

## How way selection works in the demo

OpenFreeMap's vector tiles (built with planetiler, OpenMapTiles schema) encode the source OSM
element in each feature ID as `osmId × 10 + type` (1 = node, 2 = way, 3 = relation). The demo reads
that ID from the clicked road feature and fetches the way from Overpass. Two caveats:

- Below zoom 14, most road features are **merged** from several ways, so selection is only enabled
  from zoom 14.
- Even at zoom 14, planetiler merges some features (type digit `0`). The remaining ID is the first
  merged way, which may not be the clicked segment. The demo then shows a notice and highlights the
  way it actually loaded.

## Data sources and usage policies

- **Overpass API.** `fetchWay` defaults to `https://overpass-api.de/api/interpreter`, operated by
  FOSSGIS e.V. under their
  [terms of use](https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/). In short:
  low request volumes only (no bulk downloads), visible OSM attribution, a contact address, and a
  configurable endpoint. The demo requests a way only on an explicit click or deep link, caches
  results per session, keeps at most one request in flight and backs off when the server is busy.
  If you build on this library, **please pass your own `endpoint`**; outside browsers, also send a
  `User-Agent` that identifies your application. The demo's endpoint can be changed at build time
  with `VITE_OVERPASS_ENDPOINT`.
- **Tiles.** [OpenFreeMap](https://openfreemap.org/), style
  `https://tiles.openfreemap.org/styles/liberty`.
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
