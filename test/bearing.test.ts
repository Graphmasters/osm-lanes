import { describe, expect, it } from 'vitest'
import { wayBearing } from '../src/osm/bearing'
import { compassPoint, renderCompassSvg } from '../src/svg/compass'

const p = (lat: number, lon: number) => ({ lat, lon })

describe('wayBearing', () => {
  it('returns the cardinal directions', () => {
    expect(wayBearing([p(52, 9), p(52.01, 9)])).toBeCloseTo(0)
    expect(wayBearing([p(52, 9), p(52, 9.01)])).toBeCloseTo(90)
    expect(wayBearing([p(52, 9), p(51.99, 9)])).toBeCloseTo(180)
    expect(wayBearing([p(52, 9), p(52, 8.99)])).toBeCloseTo(270)
  })

  it('corrects longitude for latitude', () => {
    // At 60° N a degree of longitude is half as long as a degree of latitude.
    expect(wayBearing([p(60, 10), p(60.01, 10.02)])).toBeCloseTo(45, 0)
  })

  it('weights segments by length', () => {
    // long segment east, short one north → mostly east
    const b = wayBearing([p(52, 9), p(52, 9.01), p(52.001, 9.01)])!
    expect(b).toBeGreaterThan(80)
    expect(b).toBeLessThan(90)
  })

  it('wraps around north', () => {
    const b = wayBearing([p(52, 9), p(52.01, 8.9999)])!
    expect(b).toBeGreaterThan(359)
    expect(b).toBeLessThan(360)
  })

  it('returns null without a usable direction', () => {
    expect(wayBearing(undefined)).toBeNull()
    expect(wayBearing([p(52, 9)])).toBeNull()
    expect(wayBearing([p(52, 9), p(52, 9)])).toBeNull()
    // closed ring
    expect(wayBearing([p(52, 9), p(52, 9.001), p(52.001, 9.001), p(52.001, 9), p(52, 9)])).toBeNull()
  })
})

describe('compass', () => {
  it('names compass points', () => {
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(47)).toBe('NE')
    expect(compassPoint(359)).toBe('N')
    expect(compassPoint(90, 'de')).toBe('O')
    expect(compassPoint(-45)).toBe('NW')
  })

  it('renders the bearing as arrow and text', () => {
    const svg = renderCompassSvg(47.4, { locale: 'de' })
    expect(svg).toContain('rotate(47.4)')
    expect(svg).toContain('47° NO')
    expect(svg).toContain('aria-label="Wegrichtung (oben in der Fahrstreifengrafik): 47° (NO)"')
  })

  it('renders nothing without a bearing', () => {
    expect(renderCompassSvg(null)).toBe('')
    expect(renderCompassSvg(Number.NaN)).toBe('')
  })
})
