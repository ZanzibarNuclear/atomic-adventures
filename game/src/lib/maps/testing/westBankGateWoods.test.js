import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import {
  buildTravelWorld,
  offeredMoves,
} from './travelWorld.js'
import { standAcrossOpening } from '../composables/usePassageCrossing.js'
import {
  BARRIER_STAND_INSET,
  distToBarrierKind,
} from '../composables/useBarrierStand.js'
import { isEastOfRiverAt, isWestOfRiverAt } from './riverSide.js'

describe('west bank direct moves', () => {
  const world = buildTravelWorld(mapData)
  it('steps into a safe stand in the west-side area of north-west', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'upper-gorge'
    outdoor.state.stand = outdoor.defaultStandForHex('upper-gorge')
    outdoor.crossPassage('upper-gorge-bridge')

    outdoor.moveTo('north-west')
    expect(outdoor.state.currentId).toBe('north-west')
    expect(isWestOfRiverAt(outdoor.state.stand, world.ctx.barriers)).toBe(true)
    expect(isEastOfRiverAt(outdoor.state.stand, world.ctx.barriers)).toBe(false)
    expect(
      distToBarrierKind(outdoor.state.stand, 'river', world.ctx.barriers),
    ).toBeGreaterThanOrEqual(BARRIER_STAND_INSET.river)

    const { directMoves } = offeredMoves(
      world,
      world.hexById['north-west'],
      outdoor.state.stand,
    )
    const destinations = directMoves.map((m) => m.toHexId)
    expect(destinations).toContain('upper-gorge')
    expect(destinations).not.toContain('gate-woods')
  })

  it('offers north-west from west bank at upper-gorge', () => {
    const ug = world.hexById['upper-gorge']
    const east = world.resolveStand(ug)
    const bridge = world.ctx.openings.find((o) => o.id === 'upper-gorge-bridge')
    const west = standAcrossOpening(bridge, east, world.ctx, world.size)
    const { routeMoves, directMoves } = offeredMoves(world, ug, west)
    expect(routeMoves.map((m) => m.toHexId)).not.toContain('road-fork')
    expect(directMoves.map((m) => m.toHexId)).toContain('north-west')
  })

  it('uses a short straight chord', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'upper-gorge'
    outdoor.state.stand = outdoor.defaultStandForHex('upper-gorge')
    outdoor.crossPassage('upper-gorge-bridge')
    const before = { ...outdoor.state.stand }
    outdoor.moveTo('north-west')
    const dist = Math.hypot(
      outdoor.state.stand.x - before.x,
      outdoor.state.stand.y - before.y,
    )
    expect(dist).toBeLessThan(120)
  })

})
