import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { standAcrossOpening } from '../composables/usePassageCrossing.js'

describe('upper-gorge east bank', () => {
  const world = buildTravelWorld(mapData)

  it('does not walk directly to north-west from the east bank (cross bridge first)', () => {
    const ug = world.hexById['upper-gorge']
    const stand = world.resolveStand(ug)
    const nw = evaluateNeighborMove(
      world,
      ug,
      world.hexById['north-west'],
      stand,
    )
    expect(stand.x).toBeGreaterThan(-140)
    expect(nw.reachable).toBe(false)
    expect(nw.result.blockedKind).toBe('river')
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
