import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { travelOpenings } from '../composables/useBarrierOpenings.js'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'

describe('opening discovery', () => {
  const hexById = Object.fromEntries(mapData.hexes.map((h) => [h.id, h]))
  const size = mapData.size ?? 44

  it('omits hidden openings until discovered', () => {
    const without = travelOpenings(mapData.features, { hexById, size })
    const withHole = travelOpenings(mapData.features, {
      hexById,
      size,
      discoveredOpenings: ['south-pines-hole'],
    })
    expect(without.some((o) => o.id === 'south-pines-hole')).toBe(false)
    expect(withHole.some((o) => o.id === 'south-pines-hole')).toBe(true)
    expect(without.some((o) => o.id === 'upper-gorge-bridge')).toBe(true)
  })

  it('south-pines hole enables in-hex crossing after search', () => {
    const world = buildTravelWorld(mapData)
    const from = world.hexById['lower-stand']
    const to = world.hexById['south-pines']
    const before = evaluateNeighborMove(world, from, to, world.resolveStand(from))
    expect(before.enters).toBe(true)
    expect(before.reachable).toBe(true)

    world.revealOpening('south-pines-hole')
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'south-pines'
    outdoor.state.stand = before.result.stand
    outdoor.state.discoveredOpenings = ['south-pines-hole']
    expect(outdoor.passageCrossings.some((c) => c.openingId === 'south-pines-hole')).toBe(
      true,
    )
  })
})
