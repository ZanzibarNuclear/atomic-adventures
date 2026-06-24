import { describe, it, expect } from 'vitest'
import { mapData } from '../../testing/content.js'
import { axialToPixel } from '../composables/useHexGeometry.js'
import { buildTravelWorld } from './travelWorld.js'
import {
  availablePassageCrossings,
  PASSAGE_CROSSING_INSET,
  resolvePassageStand,
  standAcrossOpening,
  shouldOfferPassageCrossing,
} from '../composables/usePassageCrossing.js'
import { distToBarrierKind } from '../composables/useBarrierStand.js'
import { barrierKindForOpening } from '../composables/useBarrierOpenings.js'
import { isEastOfRiverAt, isWestOfRiverAt } from './riverSide.js'

describe('usePassageCrossing', () => {
  const world = buildTravelWorld(mapData)

  it('places stand on opposite side of river at bridge', () => {
    const bridge = world.ctx.openings.find((o) => o.id === 'upper-gorge-bridge')
    const east = { x: bridge.x + 20, y: bridge.y }
    const west = standAcrossOpening(bridge, east, world.ctx)
    expect(west.x).toBeLessThan(bridge.x)
    expect(shouldOfferPassageCrossing(bridge, east, world.ctx, null)).toBe(true)
    expect(shouldOfferPassageCrossing(bridge, west, world.ctx, null)).toBe(true)
  })

  it('offers ford only after discovery when east of the river', () => {
    const mw = world.hexById['the-flats']
    const center = axialToPixel(mw.q, mw.r, world.size)
    const eastBank = { x: center.x + world.size * 0.35, y: center.y }

    const before = availablePassageCrossings({
      hexId: mw.id,
      fromPos: eastBank,
      mapFeatures: mapData.features,
      ctx: world.ctx,
      hexById: world.hexById,
      size: world.size,
    })
    expect(before.some((c) => c.openingId === 'the-flats-ford')).toBe(false)

    world.revealOpening('the-flats-ford')
    const after = availablePassageCrossings({
      hexId: mw.id,
      fromPos: eastBank,
      mapFeatures: mapData.features,
      ctx: world.ctx,
      hexById: world.hexById,
      size: world.size,
      discoveredOpenings: world.discoveredOpenings,
    })
    expect(after.some((c) => c.openingId === 'the-flats-ford')).toBe(true)
  })

  it('ford crossing flips river side in one step from the west bank', () => {
    world.revealOpening('the-flats-ford')
    const ford = world.ctx.openings.find((o) => o.id === 'the-flats-ford')
    const from = { x: ford.x - world.size * 0.5, y: ford.y }
    expect(isWestOfRiverAt(from, world.ctx.barriers)).toBe(true)
    const cross = standAcrossOpening(ford, from, world.ctx, world.size)
    expect(isEastOfRiverAt(cross, world.ctx.barriers)).toBe(true)
  })

  it('resolvePassageStand matches standAcrossOpening when ideal is legal', () => {
    const bridge = world.ctx.openings.find((o) => o.id === 'upper-gorge-bridge')
    const ug = world.hexById['upper-gorge']
    const east = { x: bridge.x + 20, y: bridge.y }
    const ideal = standAcrossOpening(bridge, east, world.ctx)
    const resolved = resolvePassageStand(bridge, east, world.ctx, world.size, ug)
    expect(resolved).toEqual(ideal)
  })

  it('uses the same visible separation for bridge, ford, gate, and hole crossings', () => {
    world.revealOpening('the-flats-ford')
    world.revealOpening('south-pines-hole')
    const cases = [
      ['upper-gorge-bridge', { dx: 20, dy: 0 }],
      ['the-flats-ford', { dx: -world.size * 0.5, dy: 0 }],
      ['compound-gate', { dx: 0, dy: -14 }],
      ['south-pines-hole', { dx: 14, dy: 0 }],
    ]

    for (const [openingId, offset] of cases) {
      const opening = world.ctx.openings.find((o) => o.id === openingId)
      const hex = world.hexById[opening.hex]
      const from = { x: opening.x + offset.dx, y: opening.y + offset.dy }
      const stand = resolvePassageStand(opening, from, world.ctx, world.size, hex)
      const barrierKind = barrierKindForOpening(opening.kind)

      expect(stand, openingId).toBeTruthy()
      expect(distToBarrierKind(stand, barrierKind, world.ctx.barriers)).toBeCloseTo(
        PASSAGE_CROSSING_INSET,
        0,
      )
      expect(Math.hypot(stand.x - opening.x, stand.y - opening.y)).toBeLessThan(
        PASSAGE_CROSSING_INSET + 3,
      )
    }
  })
})
