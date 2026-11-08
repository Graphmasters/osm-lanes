import type { AccessMode, RoadLanes } from '../lanes/model'
import { KNOWN_ARROWS } from './arrows'
import { label, type LabelKey, type Locale } from './labels'

export interface LegendEntry {
  id: string
  label: string
}

export interface LegendOptions {
  locale?: Locale
  labels?: Partial<Record<string, string>>
}

/** Text glyph per turn value, matching the direction of the arrow in the lane graphic. */
export const TURN_GLYPHS: Readonly<Record<string, string>> = {
  through: '↑',
  left: '←',
  slight_left: '↖',
  sharp_left: '↙',
  right: '→',
  slight_right: '↗',
  sharp_right: '↘',
  reverse: '↶',
  merge_to_left: '⇖',
  merge_to_right: '⇗',
}

/** Explains the symbols that occur in the lane graphic of this road. */
export function getLanesLegend(road: RoadLanes, options: LegendOptions = {}): LegendEntry[] {
  const { locale = 'en', labels } = options
  const L = (k: LabelKey) => label(locale, k, labels)
  const lanes = [...road.forward, ...road.bothWays, ...road.backward]
  const entries: LegendEntry[] = []
  const seen = new Set<string>()
  const add = (id: string, text: string) => {
    if (seen.has(id)) return
    seen.add(id)
    entries.push({ id, label: text })
  }

  for (const lane of lanes) {
    for (const t of lane.turn) {
      if (KNOWN_ARROWS.has(t)) add(`turn.${t}`, `${TURN_GLYPHS[t] ?? '↑'} ${L(`turn.${t}` as LabelKey)}`)
      else add('turn.unknown', `? ${L('turn.unknown')}`)
    }
  }
  if (road.bothWays.length) add('both_ways', `⇅ ${L('both_ways')}`)
  for (const lane of lanes) {
    for (const [mode, value] of Object.entries(lane.access) as [AccessMode, string][]) {
      if (value === 'designated') add(`designated.${mode}`, `${L('access.designated')} ${L(`mode.${mode}` as LabelKey)}`)
      if (value === 'no') add(`no.${mode}`, `${L('access.no')} ${L(`mode.${mode}` as LabelKey)}`)
    }
    if (lane.maxspeed) add('maxspeed', L('sign.maxspeed'))
    if (lane.minspeed) add('minspeed', L('sign.minspeed'))
    if (lane.maxheight) add('maxheight', L('sign.maxheight'))
    if (lane.maxweight) add('maxweight', L('sign.maxweight'))
    if (lane.width) add('width', L('width'))
    if (lane.change === 'no') add('line.solid', L('line.solid'))
    if (lane.change === 'not_left' || lane.change === 'not_right') add('line.mixed', L('line.mixed'))
  }
  return entries
}
