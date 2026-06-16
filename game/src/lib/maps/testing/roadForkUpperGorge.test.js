import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import { hexCenterStand } from '../composables/useAvatarStand.js'
import { isEastOfRiverAt } from '../composables/usePassageCrossing.js'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'

/** Stand at road-fork after walking north-bend → road-fork (compound road end). */
function standAtRoadForkFromNorth(world) {
  const nb = world.hexById['north-bend']
  const rf = world.hexById['road-fork']
  return evaluateNeighborMove(world, nb, rf, world.resolveStand(nb)).result.stand
}

describe('road-fork → upper-gorge', () => {
  const world = buildTravelWorld(mapData)
  const ug = world.hexById['upper-gorge']
  const center = hexCenterStand(ug, world.size)

  it('follows the drive and stops at the east bank, not hex center', () => {
    const rf = world.hexById['road-fork']
    const atFork = standAtRoadForkFromNorth(world)
    const m = evaluateNeighborMove(world, rf, ug, atFork)

    expect(m.reachable).toBe(true)
    expect(m.result.activeHexId).toBe('upper-gorge')
    expect(m.result.blockedKind).toBeNull()
    expect(m.path.length).toBeGreaterThan(2)
    expect(m.routeLeg?.routeId).toBe('river-access-drive')
    expect(isEastOfRiverAt(m.result.stand, world.ctx.barriers)).toBe(true)
    expect(m.result.stand.x).toBeCloseTo(-133, 0)
    expect(m.result.stand.y).toBeCloseTo(-130, 0)
    expect(m.result.stand.x).not.toBeCloseTo(center.x, 0)
  })

  it('moveTo matches evaluateNeighborMove from the north-bend approach', async () => {
    const atFork = standAtRoadForkFromNorth(world)
    const expected = evaluateNeighborMove(
      world,
      world.hexById['road-fork'],
      ug,
      atFork,
    )

    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'road-fork'
    outdoor.state.stand = atFork
    outdoor.moveTo('upper-gorge')
    await new Promise((r) => setTimeout(r, 700))

    expect(outdoor.state.currentId).toBe('upper-gorge')
    expect(outdoor.state.atBarrier).toBe('river')
    expect(outdoor.state.stand.x).toBe(Math.round(expected.result.stand.x))
    expect(outdoor.state.stand.y).toBe(Math.round(expected.result.stand.y))
    expect(outdoor.state.stand.x).not.toBe(Math.round(center.x))
    expect(isEastOfRiverAt(outdoor.state.stand, outdoor.rivers)).toBe(true)
  })
})
