import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import {
  availablePassageCrossings,
  standAcrossOpening,
} from '../composables/usePassageCrossing.js'
import { buildTravelWorld, offeredMoves } from './travelWorld.js'

describe('in-hex passage crossing', () => {
  const world = buildTravelWorld(mapData)

  it('offers bridge crossing from east bank at upper-gorge', () => {
    const ug = world.hexById['upper-gorge']
    const stand = world.resolveStand(ug)
    const crossings = availablePassageCrossings({
      hexId: ug.id,
      fromPos: stand,
      mapFeatures: mapData.features,
      ctx: world.ctx,
      hexById: world.hexById,
      size: world.size,
    })
    expect(crossings.map((c) => c.openingId)).toContain('upper-gorge-bridge')
    expect(crossings[0].label).toBe('Cross the bridge')
  })

  it('crossing the bridge stays in upper-gorge on the west bank', () => {
    const ug = world.hexById['upper-gorge']
    const east = world.resolveStand(ug)
    const bridge = world.ctx.openings.find((o) => o.id === 'upper-gorge-bridge')
    const west = standAcrossOpening(bridge, east, world.ctx)

    expect(west).not.toBeNull()
    expect(world.hexAtPoint(west, ug.id)).toBe(ug.id)
    expect(west.x).toBeLessThan(east.x)

    const crossingsAfter = availablePassageCrossings({
      hexId: ug.id,
      fromPos: west,
      mapFeatures: mapData.features,
      ctx: world.ctx,
      hexById: world.hexById,
      size: world.size,
    })
    expect(crossingsAfter.some((c) => c.openingId === 'upper-gorge-bridge')).toBe(
      true,
    )
  })

  it('toggles travel options between banks', () => {
    const ug = world.hexById['upper-gorge']
    const east = world.resolveStand(ug)
    const bridge = world.ctx.openings.find((o) => o.id === 'upper-gorge-bridge')
    const west = standAcrossOpening(bridge, east, world.ctx)

    const eastDirect = offeredMoves(world, ug, east).directMoves.map((m) => m.toHexId)
    const westDirect = offeredMoves(world, ug, west).directMoves.map((m) => m.toHexId)
    expect(eastDirect).toContain('north-west')
    expect(westDirect).toContain('north-west')

    const crossings = availablePassageCrossings({
      hexId: ug.id,
      fromPos: west,
      mapFeatures: mapData.features,
      ctx: world.ctx,
      hexById: world.hexById,
      size: world.size,
    })
    expect(crossings.some((crossing) => crossing.openingId === 'upper-gorge-bridge')).toBe(true)
  })
})
