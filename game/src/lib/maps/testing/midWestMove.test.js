import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import {
  buildTravelWorld,
  evaluateNeighborMove,
  offeredMoves,
  adjacentHexes,
  enumerateBarrierStandMoves,
} from './travelWorld.js'
import { hexOnRiverBank } from '../composables/useRiverBank.js'

const world = buildTravelWorld(mapData)

describe('mid-west → utility-yard along river', () => {
  it('both hexes are on the river bank', () => {
    expect(hexOnRiverBank(world.hexById['mid-west'], world.size, world.rivers)).toBe(true)
    expect(hexOnRiverBank(world.hexById['utility-yard'], world.size, world.rivers)).toBe(true)
  })

  it('should offer and reach utility-yard from mid-west default stand', () => {
    const midWest = world.hexById['mid-west']
    const fromPos = world.resolveStand(midWest)
    const m = evaluateNeighborMove(
      world,
      midWest,
      world.hexById['utility-yard'],
      fromPos,
    )

    expect(m.offerable, JSON.stringify({ result: m.result, hit: m.hit })).toBe(true)
    expect(m.reachable, JSON.stringify(m.result)).toBe(true)
    expect(m.result.blockedKind).toBeNull()
  })

  it('offeredMoves includes utility-yard from mid-west', () => {
    const midWest = world.hexById['mid-west']
    const { routeMoves, directMoves } = offeredMoves(
      world,
      midWest,
      world.resolveStand(midWest),
    )
    const dests = [...routeMoves, ...directMoves].map((d) => d.toHexId)
    expect(dests).toContain('utility-yard')
  })

  it('every adjacent river-bank step along q=-2 reaches utility-yard', () => {
    const uy = world.hexById['utility-yard']
    for (const from of adjacentHexes(uy, world.hexes)) {
      if (!hexOnRiverBank(from, world.size, world.rivers)) continue
      const m = evaluateNeighborMove(world, from, uy, world.resolveStand(from))
      expect(
        m.reachable,
        `${from.id} → utility-yard: ${JSON.stringify(m.result)} hit=${m.hit?.kind}`,
      ).toBe(true)
    }
  })

  it('follow-up step from north-west through mid-west reaches utility-yard', () => {
    const northWest = world.hexById['north-west']
    const midWest = world.hexById['mid-west']
    const uy = world.hexById['utility-yard']

    const step1 = evaluateNeighborMove(
      world,
      northWest,
      midWest,
      world.resolveStand(northWest),
    )
    expect(step1.reachable, JSON.stringify(step1.result)).toBe(true)

    const step2Default = evaluateNeighborMove(world, midWest, uy, step1.result.stand)
    expect(
      step2Default.reachable,
      `after NW→MW stand ${JSON.stringify(step1.result.stand)}: ${JSON.stringify(step2Default.result)} hit=${step2Default.hit?.kind}`,
    ).toBe(true)
  })
})
