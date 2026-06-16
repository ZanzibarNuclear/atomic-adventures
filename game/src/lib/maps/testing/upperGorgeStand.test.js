import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { pixelToHex } from '../composables/useHexGeometry.js'
import { standAcrossOpening } from '../composables/usePassageCrossing.js'

describe('upper-gorge stand tuning', () => {
  it('finds stand inside upper-gorge hex', () => {
    const world = buildTravelWorld(mapData)
    const ug = world.hexById['upper-gorge']
    const stand = world.resolveStand(ug)
    const { q, r } = pixelToHex(stand.x, stand.y, world.size)
    expect(q).toBe(ug.q)
    expect(r).toBe(ug.r)
  })

  it('reaches north-west from the west bank, not from the east-bank stand', () => {
    const world = buildTravelWorld(mapData)
    const ug = world.hexById['upper-gorge']
    const east = world.resolveStand(ug)
    const bridge = world.ctx.openings.find((o) => o.id === 'upper-gorge-bridge')
    const west = standAcrossOpening(bridge, east, world.ctx, world.size)

    const fromEast = evaluateNeighborMove(
      world,
      ug,
      world.hexById['north-west'],
      east,
    )
    expect(fromEast.reachable).toBe(false)

    const fromWest = evaluateNeighborMove(
      world,
      ug,
      world.hexById['north-west'],
      west,
    )
    expect(fromWest.reachable).toBe(true)
    expect(fromWest.result.activeHexId).toBe('north-west')
  })
})
