import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { axialToPixel } from '../composables/useHexGeometry.js'
import { hexCenterStand } from '../composables/useAvatarStand.js'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import {
  availablePassageCrossings,
  standAcrossOpening,
  shouldOfferPassageCrossing,
  isEastOfRiverAt,
} from '../composables/usePassageCrossing.js'

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
    const mw = world.hexById['mid-west']
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
    expect(before.some((c) => c.openingId === 'mid-west-ford')).toBe(false)

    world.revealOpening('mid-west-ford')
    const after = availablePassageCrossings({
      hexId: mw.id,
      fromPos: eastBank,
      mapFeatures: mapData.features,
      ctx: world.ctx,
      hexById: world.hexById,
      size: world.size,
      discoveredOpenings: world.discoveredOpenings,
    })
    expect(after.some((c) => c.openingId === 'mid-west-ford')).toBe(true)
  })

  it('ford crossing flips river side in one step from the west bank', () => {
    world.revealOpening('mid-west-ford')
    const ford = world.ctx.openings.find((o) => o.id === 'mid-west-ford')
    const nw = world.hexById['north-west']
    const mw = world.hexById['mid-west']
    const from = evaluateNeighborMove(
      world,
      nw,
      mw,
      hexCenterStand(nw, world.size),
    ).result.stand
    const cross = standAcrossOpening(ford, from, world.ctx, world.size)
    expect(isEastOfRiverAt(cross, world.ctx.barriers)).toBe(true)
  })
})
