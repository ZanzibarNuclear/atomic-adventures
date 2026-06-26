import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import { travelOpenings, buildPassageMarkers } from '../composables/useBarrierOpenings.js'
import { buildRouteModels } from '../composables/useRoutes.js'
import { barrierSegments } from '../composables/useTravelBarriers.js'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'

describe('opening discovery', () => {
  const hexById = Object.fromEntries(mapData.hexes.map((h) => [h.id, h]))
  const size = mapData.size ?? 44
  const barriers = barrierSegments(
    buildRouteModels(
      (mapData.features ?? []).filter((f) => f.kind !== 'gate' && f.kind !== 'hole' && f.kind !== 'bridge' && f.kind !== 'ford'),
      hexById,
      mapData.hexes ?? [],
      size,
    ),
  )

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

  it('compound gate marker follows explicit passage state', () => {
    const locked = buildPassageMarkers(mapData.features, hexById, size, {
      passageStates: { 'compound-gate': false },
      barriers,
    })
    const unlocked = buildPassageMarkers(mapData.features, hexById, size, {
      passageStates: { 'compound-gate': true },
      barriers,
    })
    const gateLocked = locked.find((m) => m.id === 'compound-gate')
    const gateUnlocked = unlocked.find((m) => m.id === 'compound-gate')
    expect(gateLocked?.open).toBe(false)
    expect(gateUnlocked?.open).toBe(true)
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
