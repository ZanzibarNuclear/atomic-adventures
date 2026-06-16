import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { isEastOfRiverAt } from '../composables/usePassageCrossing.js'

describe('road-fork → upper-gorge', () => {
  const world = buildTravelWorld(mapData)

  it('stops at the river bank on the drive, not hex center', () => {
    const gw = world.hexById['gate-woods']
    const rf = world.hexById['road-fork']
    const ug = world.hexById['upper-gorge']
    const atFork = evaluateNeighborMove(
      world,
      gw,
      rf,
      world.resolveStand(gw),
    ).result.stand
    const m = evaluateNeighborMove(world, rf, ug, atFork)

    expect(m.reachable).toBe(true)
    expect(m.result.activeHexId).toBe('upper-gorge')
    expect(m.result.blockedKind).toBeNull()
    expect(isEastOfRiverAt(m.result.stand, world.ctx.barriers)).toBe(true)
    expect(m.result.stand.x).toBeCloseTo(-133, 0)
    expect(m.result.stand.y).toBeCloseTo(-130, 0)
    expect(m.result.stand.x).not.toBeCloseTo(-152, 0)
  })

  it('sets atBarrier river in outdoor play', async () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'road-fork'
    outdoor.state.stand = outdoor.defaultStandForHex('road-fork')
    outdoor.moveTo('upper-gorge')
    await new Promise((r) => setTimeout(r, 700))

    expect(outdoor.state.currentId).toBe('upper-gorge')
    expect(outdoor.state.atBarrier).toBe('river')
    expect(isEastOfRiverAt(outdoor.state.stand, outdoor.rivers)).toBe(true)
  })
})
