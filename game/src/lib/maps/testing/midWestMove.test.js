import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove, offeredMoves, adjacentHexes } from './travelWorld.js'
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

  it('bank positions south of center still reach utility-yard', () => {
    const midWest = world.hexById['mid-west']
    const uy = world.hexById['utility-yard']
    const bank = world.resolveStand(midWest)
    for (let dy = -20; dy <= 40; dy += 10) {
      const fromPos = { x: bank.x, y: bank.y + dy }
      const m = evaluateNeighborMove(world, midWest, uy, fromPos)
      expect(m.reachable, `dy=${dy} ${JSON.stringify(m.result)}`).toBe(true)
      expect(m.offerable).toBe(true)
    }
  })

  it('utility-yard to mid-west along the river bank', () => {
    const midWest = world.hexById['mid-west']
    const uy = world.hexById['utility-yard']
    const m = evaluateNeighborMove(world, uy, midWest, world.resolveStand(uy))
    expect(m.reachable, JSON.stringify({ result: m.result, hit: m.hit })).toBe(true)
    expect(m.offerable).toBe(true)
  })
})
