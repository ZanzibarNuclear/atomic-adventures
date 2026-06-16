import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove, offeredMoves, adjacentHexes } from './travelWorld.js'
import { hexCenterStand } from '../composables/useAvatarStand.js'

const world = buildTravelWorld(mapData)

const BANK_HEXES = new Set(['north-west', 'mid-west', 'utility-yard'])

describe('mid-west → utility-yard along river', () => {
  it('bank hexes have authored standAt', () => {
    expect(world.hexById['mid-west'].standAt).toEqual({ dx: 0.23, dy: 0 })
    expect(world.hexById['utility-yard'].standAt?.from).toBe('landmark')
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

  it('every adjacent bank hex step along q=-2 reaches utility-yard from west-bank stands', () => {
    const uy = world.hexById['utility-yard']
    for (const from of adjacentHexes(uy, world.hexes)) {
      if (!BANK_HEXES.has(from.id)) continue
      const fromPos =
        from.id === 'utility-yard'
          ? world.resolveStand(from)
          : hexCenterStand(from, world.size)
      const m = evaluateNeighborMove(world, from, uy, fromPos)
      expect(
        m.reachable,
        `${from.id} → utility-yard: ${JSON.stringify(m.result)} hit=${m.hit?.kind}`,
      ).toBe(true)
    }
  })

  it('west-bank positions along mid-west reach utility-yard', () => {
    const midWest = world.hexById['mid-west']
    const uy = world.hexById['utility-yard']
    const fromPos = hexCenterStand(midWest, world.size)
    const m = evaluateNeighborMove(world, midWest, uy, fromPos)
    expect(m.reachable, JSON.stringify(m.result)).toBe(true)
    expect(m.offerable).toBe(true)
  })

  it('utility-yard to mid-west along the river bank', () => {
    const midWest = world.hexById['mid-west']
    const uy = world.hexById['utility-yard']
    const arrive = evaluateNeighborMove(
      world,
      midWest,
      uy,
      hexCenterStand(midWest, world.size),
    )
    const m = evaluateNeighborMove(world, uy, midWest, arrive.result.stand)
    expect(m.reachable, JSON.stringify({ result: m.result, hit: m.hit })).toBe(true)
    expect(m.offerable).toBe(true)
  })
})
