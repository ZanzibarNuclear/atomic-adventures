import { describe, it, expect } from 'vitest'
import {
  evaluateMapViewport,
  normalizeMapMode,
} from '../composables/useHexMapViewport.js'
import {
  axialToPixel,
  fixedGameplayViewBox,
  gameplayViewDimensions,
} from '../composables/useHexGeometry.js'

const size = 44
const hexes = [
  { id: 'center-pines', q: 0, r: 0, terrain: 'forest' },
  { id: 'east-pines', q: 1, r: 0, terrain: 'forest' },
  { id: 'origin', q: 2, r: 0, terrain: 'forest' },
  { id: 'far-pines', q: 1, r: -1, terrain: 'forest' },
  { id: 'utility-yard', q: -2, r: 1, terrain: 'yard' },
]

describe('normalizeMapMode', () => {
  it('maps legacy modes to gameplay', () => {
    expect(normalizeMapMode('slice')).toBe('gameplay')
    expect(normalizeMapMode('explored')).toBe('gameplay')
    expect(normalizeMapMode(undefined)).toBe('gameplay')
  })

  it('preserves gameplay and full', () => {
    expect(normalizeMapMode('gameplay')).toBe('gameplay')
    expect(normalizeMapMode('full')).toBe('full')
  })
})

describe('evaluateMapViewport — gameplay', () => {
  it('shows origin and fog neighbor at start', () => {
    const vp = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'origin',
      discovered: ['origin'],
      mode: 'gameplay',
      size,
    })

    expect(vp.visibleHexes.map((h) => h.id)).toEqual(['origin'])
    expect(vp.fogHexes.map((h) => h.id)).toEqual(['east-pines'])
  })

  it('keeps fixed viewBox size after visiting more hexes', () => {
    const start = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'origin',
      discovered: ['origin'],
      mode: 'gameplay',
      size,
    })
    const later = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'east-pines',
      discovered: ['origin', 'east-pines', 'center-pines', 'far-pines'],
      mode: 'gameplay',
      size,
    })

    expect(later.viewBox.width).toBe(start.viewBox.width)
    expect(later.viewBox.height).toBe(start.viewBox.height)
  })

  it('centers viewBox on the current hex', () => {
    const vp = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'east-pines',
      discovered: ['origin', 'east-pines'],
      mode: 'gameplay',
      size,
    })
    const center = axialToPixel(1, 0, size)
    const boxCenterX = vp.viewBox.x + vp.viewBox.width / 2
    const boxCenterY = vp.viewBox.y + vp.viewBox.height / 2
    expect(Math.abs(boxCenterX - center.x)).toBeLessThan(1)
    expect(Math.abs(boxCenterY - center.y)).toBeLessThan(1)
  })

  it('shows multiple discovered hexes when they fit in the viewport', () => {
    const vp = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'east-pines',
      discovered: ['origin', 'east-pines'],
      mode: 'gameplay',
      size,
    })

    const ids = vp.visibleHexes.map((h) => h.id).sort()
    expect(ids).toEqual(['east-pines', 'origin'])
  })

  it('only fogs undiscovered neighbors of the current hex', () => {
    const vp = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'east-pines',
      discovered: ['origin', 'east-pines'],
      mode: 'gameplay',
      size,
    })

    expect(vp.fogHexes.map((h) => h.id).sort()).toEqual([
      'center-pines',
      'far-pines',
    ])
  })

  it('does not fog undiscovered hexes that are not neighbors of current', () => {
    const vp = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'origin',
      discovered: ['origin'],
      mode: 'gameplay',
      size,
    })

    expect(vp.fogHexes.some((h) => h.id === 'east-pines')).toBe(true)
    expect(vp.fogHexes.some((h) => h.id === 'center-pines')).toBe(false)
    expect(vp.fogHexes.some((h) => h.id === 'utility-yard')).toBe(false)
  })

  it('drops fog for hexes that are no longer neighbors of current', () => {
    const atOrigin = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'origin',
      discovered: ['origin'],
      mode: 'gameplay',
      size,
    })
    expect(atOrigin.fogHexes.map((h) => h.id)).toEqual(['east-pines'])

    const atEastPines = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'east-pines',
      discovered: ['origin', 'east-pines'],
      mode: 'gameplay',
      size,
    })
    expect(atEastPines.fogHexes.some((h) => h.id === 'east-pines')).toBe(false)
    expect(atEastPines.fogHexes.map((h) => h.id).sort()).toEqual([
      'center-pines',
      'far-pines',
    ])
  })

  it('hides discovered hexes outside the gameplay viewport', () => {
    const vp = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'origin',
      discovered: ['origin', 'east-pines', 'center-pines', 'utility-yard'],
      mode: 'gameplay',
      size,
    })

    const ids = vp.visibleHexes.map((h) => h.id).sort()
    expect(ids).toEqual(['center-pines', 'east-pines', 'origin'])
    expect(vp.visibleHexes.some((h) => h.id === 'utility-yard')).toBe(false)
  })
})

describe('evaluateMapViewport — full', () => {
  it('shows all discovered hexes with no fog', () => {
    const vp = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'east-pines',
      discovered: ['origin', 'east-pines'],
      mode: 'full',
      size,
    })

    expect(vp.visibleHexes.map((h) => h.id).sort()).toEqual([
      'east-pines',
      'origin',
    ])
    expect(vp.fogHexes).toEqual([])
  })

  it('expands viewBox to fit discovered territory', () => {
    const one = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'origin',
      discovered: ['origin'],
      mode: 'full',
      size,
    })
    const two = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: 'east-pines',
      discovered: ['origin', 'east-pines', 'center-pines'],
      mode: 'full',
      size,
    })

    expect(two.viewBox.width).toBeGreaterThan(one.viewBox.width)
  })
})

describe('gameplayViewDimensions', () => {
  it('matches fixedGameplayViewBox width and height', () => {
    const dims = gameplayViewDimensions(size)
    const box = fixedGameplayViewBox({ q: 2, r: 0 }, size)
    expect(box.width).toBe(dims.width)
    expect(box.height).toBe(dims.height)
  })
})
