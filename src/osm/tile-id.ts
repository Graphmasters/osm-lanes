// Decodes vector-tile feature IDs into OSM element references.
//
// OpenFreeMap builds its OpenMapTiles-schema tiles with planetiler, which encodes the source
// OSM element as `osmId * 10 + typeCode` (1 = node, 2 = way, 3 = relation). When planetiler
// merges several line features with identical attributes into one (common below zoom 14 and
// for paths/service roads at zoom 14), the type digit is replaced by 0 and the remaining ID is
// that of the *first* merged way only — so it may not be the segment that was clicked.
//
// This encoding is a property of the tile build pipeline, not a universal standard: verify it
// before using these helpers with tiles from another provider.

import type { OsmElementType } from './types'

export type DecodedFeatureId =
  | { kind: 'element'; type: OsmElementType; id: string }
  | { kind: 'merged'; hintWayId: string }
  | { kind: 'invalid' }

const TYPE_BY_CODE: Record<number, OsmElementType> = { 1: 'node', 2: 'way', 3: 'relation' }

export function decodeTileFeatureId(featureId: number | string | undefined | null): DecodedFeatureId {
  if (featureId === undefined || featureId === null || featureId === '') return { kind: 'invalid' }
  let big: bigint
  try {
    big = BigInt(featureId)
  } catch {
    return { kind: 'invalid' }
  }
  if (big < 10n) return { kind: 'invalid' }
  const code = Number(big % 10n)
  const id = (big / 10n).toString()
  if (code === 0) return { kind: 'merged', hintWayId: id }
  const type = TYPE_BY_CODE[code]
  return type ? { kind: 'element', type, id } : { kind: 'invalid' }
}
