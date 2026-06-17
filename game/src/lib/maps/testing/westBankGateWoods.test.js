import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import { hexCenterStand } from '../composables/useAvatarStand.js'
import { buildTravelWorld, offeredMoves } from './travelWorld.js'
import {
  isEastOfRiverAt,
  isWestOfRiverAt,
  standAcrossOpening,
} from '../composables/usePassageCrossing.js'

describe('west bank direct moves', () => {
  const world = buildTravelWorld(mapData)
  const size = world.size

  it('steps into north-west from the west bank at the reachable center', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'upper-gorge'
    outdoor.state.stand = outdoor.defaultStandForHex('upper-gorge')
    outdoor.crossPassage('upper-gorge-bridge')

    const nwCenter = hexCenterStand(world.hexById['north-west'], size)
    outdoor.moveTo('north-west')
    expect(outdoor.state.currentId).toBe('north-west')
    expect(outdoor.state.stand.x).toBe(Math.round(nwCenter.x))
    expect(outdoor.state.stand.y).toBe(Math.round(nwCenter.y))
    expect(isWestOfRiverAt(outdoor.state.stand, world.ctx.barriers)).toBe(true)
    expect(isEastOfRiverAt(outdoor.state.stand, world.ctx.barriers)).toBe(false)

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
    const { directMoves } = offeredMoves(world, ug, west)
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
