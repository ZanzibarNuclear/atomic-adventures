import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { pixelToHex } from '../composables/useHexGeometry.js'
import { resolveAvatarPosition } from '../composables/useAvatarStand.js'

describe('upper-gorge stand tuning', () => {
  it('finds stand inside upper-gorge hex', () => {
    const world = buildTravelWorld(mapData)
    const ug = world.hexById['upper-gorge']
    const stand = world.resolveStand(ug)
    const { q, r } = pixelToHex(stand.x, stand.y, world.size)
    expect(q).toBe(ug.q)
    expect(r).toBe(ug.r)

    const nw = evaluateNeighborMove(
      world,
      ug,
      world.hexById['north-west'],
      stand,
    )
    expect(nw.reachable).toBe(true)
    expect(nw.result.activeHexId).toBe('north-west')
  })
})
