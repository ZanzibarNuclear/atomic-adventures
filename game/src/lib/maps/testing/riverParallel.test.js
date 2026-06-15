import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import {
  buildTravelWorld,
  evaluateNeighborMove,
  adjacentHexes,
} from './travelWorld.js'

const world = buildTravelWorld(mapData)

describe('offerable but river-blocked moves', () => {
  it('finds mid-west moves stopped by river on execution', () => {
    const midWest = world.hexById['mid-west']
    const fromPos = world.resolveStand(midWest)
    const partial = []
    for (const to of adjacentHexes(midWest, world.hexes)) {
      const m = evaluateNeighborMove(world, midWest, to, fromPos)
      if (m.offerable && m.result.blockedKind === 'river') {
        partial.push({ to: to.id, result: m.result, hit: m.hit })
      }
    }
    expect(partial).toEqual([])
  })

  it('parallel bank column: mid-west ↔ utility-yard ignores river geometry', () => {
    const riverColumn = ['north-west', 'mid-west', 'utility-yard']
    for (let i = 0; i < riverColumn.length - 1; i++) {
      const from = world.hexById[riverColumn[i]]
      const to = world.hexById[riverColumn[i + 1]]
      const m = evaluateNeighborMove(world, from, to, world.resolveStand(from))
      if (riverColumn[i] === 'mid-west' && riverColumn[i + 1] === 'utility-yard') {
        expect(m.reachable, JSON.stringify(m.result)).toBe(true)
        expect(m.offerable).toBe(true)
        expect(m.result.blockedKind).toBeNull()
      }
    }
  })
})
