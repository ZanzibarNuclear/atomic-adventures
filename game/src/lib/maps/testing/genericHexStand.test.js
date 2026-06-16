import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { routeStandInHex } from '../composables/useTravelBarriers.js'

describe('generic hex arrival stand', () => {
  const world = buildTravelWorld(mapData)

  it('trailhead → east-pines stops mid-hex on the trail, not at edge or center', () => {
    const from = world.hexById['trailhead']
    const to = world.hexById['east-pines']
    const m = evaluateNeighborMove(world, from, to, world.resolveStand(from))
    const center = world.resolveStand(to)
    const midOnPath = routeStandInHex(m.path, to.id, world.hexAtPoint)

    expect(m.reachable).toBe(true)
    expect(m.result.activeHexId).toBe('east-pines')
    expect(midOnPath).not.toBeNull()
    expect(m.result.stand.x).toBe(midOnPath.x)
    expect(m.result.stand.y).toBe(midOnPath.y)
    expect(m.result.stand.x).not.toBe(center.x)
    expect(m.path.length).toBeGreaterThan(2)
    expect(world.hexAtPoint(m.result.stand, to.id)).toBe(to.id)
  })
})
