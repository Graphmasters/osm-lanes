# Third-party material and attribution

The source code of osm-lanes is licensed under the Apache License 2.0 (see [LICENSE](LICENSE)).
The following third-party material is included or used. It is **not** covered by the Apache
License but by the terms stated below.

## Icons — Pinhead (CC0 1.0)

Vehicle and destination-symbol icons are taken from
[Pinhead](https://github.com/waysidemapping/pinhead) v16.26.0 by Wayside Mapping and contributors,
dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
No attribution is required; we credit the project gladly. The icon path data is inlined into
`src/svg/icons.ts` by `scripts/build-assets.mjs`.

Icons used: `bicycle`, `bus`, `car`, `city_buildings`, `ferryboat`, `gasoline_pump`, `hospital_h`, `industrial_building`, `motorcycle`, `people_in_car`, `person_walking`, `plane_ascending`, `ships_wheel`, `taxi`, `town_buildings`, `tram_on_tram_track`, `transit_vehicle_on_railway_track`, `truck`, `wheelchair`, `wide_p`.

## German road signs (StVO) — public domain

Images of German traffic signs (Verkehrszeichen nach StVO) are official works and as such are in
the public domain in Germany (§ 5 Abs. 1 UrhG). The SVG files were obtained from Wikimedia Commons,
where they carry the licence templates `PD-GermanGov` and `PD-VzKat` (or `PD-Vz historisch`).
`scripts/fetch-stvo.mjs` rejects any file that additionally carries a Creative Commons, GFDL or
"self" licence template. The public-domain status rests on German law; users outside Germany should
check their local law. The original files are kept in `assets/stvo/` (provenance and SHA-256 in
`assets/stvo/sources.json`); `scripts/build-assets.mjs` strips editor metadata and namespaces the
element IDs for embedding.

| Sign | Wikimedia Commons file (author/vectoriser listed there) | Licence templates | Wikidata |
|---|---|---|---|
| Z. 237 | [Zeichen 237 - Sonderweg Radfahrer, StVO 1992.svg](https://commons.wikimedia.org/wiki/File:Zeichen_237_-_Sonderweg_Radfahrer,_StVO_1992.svg) | PD-GermanGov, PD-VzKat | [Q120828184](https://www.wikidata.org/wiki/Q120828184) |
| Z. 245 | [Zeichen 245 - Bussonderfahrstreifen, StVO 2013.svg](https://commons.wikimedia.org/wiki/File:Zeichen_245_-_Bussonderfahrstreifen,_StVO_2013.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 250 | [Zeichen 250 - Verbot für Fahrzeuge aller Art, StVO 1992.svg](https://commons.wikimedia.org/wiki/File:Zeichen_250_-_Verbot_f%C3%BCr_Fahrzeuge_aller_Art,_StVO_1992.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 253 | [Zeichen 253 - Verbot für Kraftfahrzeuge mit einem zulässigen Gesamtgewicht über 7,5t, StVO 1992.svg](https://commons.wikimedia.org/wiki/File:Zeichen_253_-_Verbot_f%C3%BCr_Kraftfahrzeuge_mit_einem_zul%C3%A4ssigen_Gesamtgewicht_%C3%BCber_7,5t,_StVO_1992.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 254 | [Zeichen 254 - Verbot für Radfahrer, StVO 1992.svg](https://commons.wikimedia.org/wiki/File:Zeichen_254_-_Verbot_f%C3%BCr_Radfahrer,_StVO_1992.svg) | PD-GermanGov, PD-VzKat | [Q141118017](https://www.wikidata.org/wiki/Q141118017) |
| Z. 260 | [Zeichen 260 - Verbot für Krafträder und Mofas und sonstige mehrspurige Kraftfahrzeuge, StVO 1992.svg](https://commons.wikimedia.org/wiki/File:Zeichen_260_-_Verbot_f%C3%BCr_Kraftr%C3%A4der_und_Mofas_und_sonstige_mehrspurige_Kraftfahrzeuge,_StVO_1992.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-5 | [Zeichen 274-5 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-5_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-10 | [Zeichen 274-10 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-10_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-20 | [Zeichen 274-20 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-20_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | [Q120828166](https://www.wikidata.org/wiki/Q120828166) |
| Z. 274-30 | [Zeichen 274-30 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-30_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | [Q140299227](https://www.wikidata.org/wiki/Q140299227) |
| Z. 274-40 | [Zeichen 274-40 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-40_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-50 | [Zeichen 274-50 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-50_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | [Q120828141](https://www.wikidata.org/wiki/Q120828141) |
| Z. 274-60 | [Zeichen 274-60 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-60_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-70 | [Zeichen 274-70 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-70_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-80 | [Zeichen 274-80 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-80_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-90 | [Zeichen 274-90 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-90_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-100 | [Zeichen 274-100 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-100_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-110 | [Zeichen 274-110 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-110_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-120 | [Zeichen 274-120 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-120_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 274-130 | [Zeichen 274-130 - Zulässige Höchstgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_274-130_-_Zul%C3%A4ssige_H%C3%B6chstgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 275-30 | [Zeichen 275-30 - Vorgeschriebene Mindestgeschwindigkeit, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_275-30_-_Vorgeschriebene_Mindestgeschwindigkeit,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 265-3.8 | [Zeichen 265-3,8 - Verbot für Fahrzeuge über angegebene tatsächliche Höhe, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_265-3,8_-_Verbot_f%C3%BCr_Fahrzeuge_%C3%BCber_angegebene_tats%C3%A4chliche_H%C3%B6he,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |
| Z. 262-5.5 | [Zeichen 262-5,5 - Verbot für Fahrzeuge über angegebene tatsächliche Masse, StVO 2017.svg](https://commons.wikimedia.org/wiki/File:Zeichen_262-5,5_-_Verbot_f%C3%BCr_Fahrzeuge_%C3%BCber_angegebene_tats%C3%A4chliche_Masse,_StVO_2017.svg) | PD-GermanGov, PD-VzKat | – |

Speed, height and weight values for which no Commons file is included (for example a 45 km/h
limit) are drawn as simplified circular signs by osm-lanes' own code (`src/svg/sign-render.ts`).

## Road markings and arrows

Lane surfaces, lane lines and turn arrows are drawn by osm-lanes' own code
(`src/svg/arrows.ts`, `src/svg/render.ts`). The arrow shapes follow the general appearance of
German direction-arrow road markings (StVO Zeichen 297) but are original drawings.

## Map and data (demo application only)

The demo application in `app/` does not bundle any map data. At runtime it uses:

- **Map data** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available
  under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).
- **Vector tiles and the "Liberty" map style** from [OpenFreeMap](https://openfreemap.org/), using the
  [OpenMapTiles](https://www.openmaptiles.org/) schema (© OpenMapTiles). The credits are shown in the
  map's attribution control.
- **Way data** from the [Overpass API](https://overpass-api.de/) instance operated by
  [FOSSGIS e.V.](https://www.fossgis.de/), used under its
  [terms of use](https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/).
- **[MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)** (BSD-3-Clause), bundled into the
  demo build.

## Inspiration

The idea of visualising OSM lane tags was inspired by
[OsmLaneVisualizer](https://github.com/mueschel/OsmLaneVisualizer) by mueschel. osm-lanes is an
independent implementation: it contains **no** code, styles, images or other material from
OsmLaneVisualizer, which is licensed under CC BY-NC-SA and therefore not compatible with this
project's licence.

## Tag documentation

Tag semantics follow the [OpenStreetMap wiki](https://wiki.openstreetmap.org/wiki/Lanes); the wiki
is linked rather than copied.
