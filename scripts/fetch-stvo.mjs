#!/usr/bin/env node
// Downloads the German road-sign (StVO) SVGs used by osm-lanes from Wikimedia Commons and
// records their provenance in assets/stvo/sources.json.
//
// Licence gate: a file is only accepted when its Commons page transcludes a German
// public-domain template (PD-GermanGov / PD-VzKat / PD-Vz historisch) AND no Creative
// Commons, GFDL or "self" licence template. Some older Commons uploads are dual-licensed
// CC-BY-SA/GFDL by their vectorizer — those are rejected so that only public-domain
// material ends up in this Apache-2.0 repository. The script exits non-zero on any rejection.
//
// Usage: node scripts/fetch-stvo.mjs [key …]   (run rarely; the result is committed)
//   With keys (e.g. `330.1`), only those signs are fetched and merged into sources.json; the
//   other files stay untouched.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'assets', 'stvo')
const UA = 'osm-lanes-asset-fetch/0.1 (https://github.com/Graphmasters/osm-lanes)'
const API = 'https://commons.wikimedia.org/w/api.php'

/** key → Commons file title. The key becomes the local file name and the lookup key in code. */
export const SIGNS = {
  ...Object.fromEntries(
    [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130].map((v) => [
      `274-${v}`,
      `File:Zeichen 274-${v} - Zulässige Höchstgeschwindigkeit, StVO 2017.svg`,
    ]),
  ),
  '275-30': 'File:Zeichen 275-30 - Vorgeschriebene Mindestgeschwindigkeit, StVO 2017.svg',
  '265-3.8': 'File:Zeichen 265-3,8 - Verbot für Fahrzeuge über angegebene tatsächliche Höhe, StVO 2017.svg',
  '262-5.5': 'File:Zeichen 262-5,5 - Verbot für Fahrzeuge über angegebene tatsächliche Masse, StVO 2017.svg',
  '245': 'File:Zeichen 245 - Bussonderfahrstreifen, StVO 2013.svg',
  '237': 'File:Zeichen 237 - Sonderweg Radfahrer, StVO 1992.svg',
  '250': 'File:Zeichen 250 - Verbot für Fahrzeuge aller Art, StVO 1992.svg',
  '253': 'File:Zeichen 253 - Verbot für Kraftfahrzeuge mit einem zulässigen Gesamtgewicht über 7,5t, StVO 1992.svg',
  '254': 'File:Zeichen 254 - Verbot für Radfahrer, StVO 1992.svg',
  '260': 'File:Zeichen 260 - Verbot für Krafträder und Mofas und sonstige mehrspurige Kraftfahrzeuge, StVO 1992.svg',
  // destination:symbol=motorway on destination signs
  '330.1': 'File:Zeichen 330.1 - Autobahn, StVO 2013.svg',
}

const PD_OK = /^Template:(PD-GermanGov|PD-VzKat|PD-Vz historisch|PD-Vz)$/i
const FORBIDDEN = /^Template:(Cc-|CC-|GFDL|Self$|Copyrighted|Attribution|FAL$|Free Art)/i

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

const stripHtml = (s = '') => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/** Batch-resolves Wikidata items whose image (P18) is one of the given Commons files. */
async function wikidataItemsFor(fileNames) {
  const values = fileNames
    .map((f) => `<http://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}>`)
    .join(' ')
  const query = `SELECT ?item ?img WHERE { VALUES ?img { ${values} } ?item wdt:P18 ?img . }`
  const res = await fetch(
    'https://query.wikidata.org/sparql?' + new URLSearchParams({ query, format: 'json' }),
    { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } },
  )
  if (!res.ok) {
    console.warn(`Wikidata lookup failed: ${res.status}`)
    return {}
  }
  const json = await res.json()
  const out = {}
  for (const b of json.results.bindings) {
    const file = decodeURIComponent(b.img.value.split('/Special:FilePath/')[1]).replace(/_/g, ' ')
    out[file] = b.item.value.split('/').pop()
  }
  return out
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const only = process.argv.slice(2)
  for (const key of only) if (!SIGNS[key]) throw new Error(`Unknown sign key ${key}`)
  const sources = only.length ? JSON.parse(await readFile(join(OUT, 'sources.json'), 'utf8')) : {}
  const rejected = []
  for (const [key, title] of Object.entries(SIGNS).filter(([k]) => !only.length || only.includes(k))) {
    const json = await api({
      action: 'query',
      titles: title,
      prop: 'imageinfo|templates',
      iiprop: 'url|extmetadata',
      tlnamespace: '10',
      tllimit: 'max',
    })
    const page = json.query.pages[0]
    if (page.missing) {
      rejected.push(`${key}: missing on Commons (${title})`)
      continue
    }
    const templates = (page.templates ?? []).map((t) => t.title)
    const pd = templates.filter((t) => PD_OK.test(t))
    const bad = templates.filter((t) => FORBIDDEN.test(t))
    if (pd.length === 0 || bad.length > 0) {
      rejected.push(`${key}: licence not acceptable (pd=[${pd}] forbidden=[${bad}]) ${title}`)
      continue
    }
    const info = page.imageinfo[0]
    const meta = info.extmetadata ?? {}
    const res = await fetch(info.url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`download ${res.status} ${info.url}`)
    const svg = await res.text()
    await writeFile(join(OUT, `${key}.svg`), svg)
    sources[key] = {
      title,
      page: info.descriptionurl,
      url: info.url,
      licence: stripHtml(meta.LicenseShortName?.value),
      licenceTemplates: pd,
      author: stripHtml(meta.Artist?.value),
      sha256: createHash('sha256').update(svg).digest('hex'),
      retrieved: new Date().toISOString().slice(0, 10),
    }
    console.log(`ok   ${key}  ${pd.join(', ')}`)
    await new Promise((r) => setTimeout(r, 300)) // be gentle with the Commons API
  }
  const qids = await wikidataItemsFor(Object.values(sources).map((s) => s.title.replace(/^File:/, '')))
  for (const s of Object.values(sources)) {
    const qid = qids[s.title.replace(/^File:/, '')]
    if (qid) s.wikidata = `https://www.wikidata.org/wiki/${qid}`
  }
  await writeFile(join(OUT, 'sources.json'), JSON.stringify(sources, null, 2) + '\n')
  if (rejected.length) {
    console.error('\nRejected:\n  ' + rejected.join('\n  '))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
