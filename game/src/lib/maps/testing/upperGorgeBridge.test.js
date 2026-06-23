import { describe, it, expect } from 'vitest'
import { mapData } from '../../testing/content.js'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { standAcrossOpening } from '../composables/usePassageCrossing.js'
import { hexCenterStand } from '../composables/useAvatarStand.js'
import { isEastOfRiverAt, isWestOfRiverAt } from './riverSide.js'

describe('upper-gorge east bank', () => {
  const world = buildTravelWorld(mapData)

  it('walks along the east river bank into north-west without crossing the river', () => {
    const ug = world.hexById['upper-gorge']
    const stand = world.resolveStand(ug)
    const nw = evaluateNeighborMove(
      world,
      ug,
      world.hexById['north-west'],
      stand,
    )
    expect(stand.x).toBeGreaterThan(-140)
    expect(nw.reachable).toBe(true)
    expect(nw.result.blockedKind).toBeNull()
    expect(nw.result.activeHexId).toBe('north-west')
    expect(isEastOfRiverAt(nw.result.stand, world.ctx.barriers)).toBe(true)
    expect(isWestOfRiverAt(nw.result.stand, world.ctx.barriers)).toBe(false)
    expect(nw.result.stand).not.toEqual(hexCenterStand(world.hexById['north-west'], world.size))
  })

  it('reaches north-west from the west bank after crossing the bridge', () => {
    const ug = world.hexById['upper-gorge']
    const stand = world.resolveStand(ug)
    const bridge = world.ctx.openings.find((o) => o.kind === 'bridge')
    const west = standAcrossOpening(bridge, stand, world.ctx, world.size)
    const nw = evaluateNeighborMove(
      world,
      ug,
      world.hexById['north-west'],
      west,
    )
    expect(nw.reachable).toBe(true)
    expect(nw.result.blockedKind).toBeNull()
    expect(nw.result.activeHexId).toBe('north-west')
  })
})
