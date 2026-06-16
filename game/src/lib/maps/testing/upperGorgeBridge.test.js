import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { firstBlockedOnPath } from '../composables/useTravelBarriers.js'

describe('upper-gorge east bank', () => {
  const world = buildTravelWorld(mapData)

  it('stands on east bank and crosses bridge to north-west', () => {
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

    const hit = firstBlockedOnPath(
      [stand, world.resolveStand(world.hexById['north-west'])],
      world.ctx,
    )
    if (hit) {
      const bridge = world.ctx.openings.find((o) => o.kind === 'bridge')
      const dist = Math.hypot(hit.x - bridge.x, hit.y - bridge.y)
      expect(dist).toBeLessThanOrEqual(bridge.r)
    }
  })
})
