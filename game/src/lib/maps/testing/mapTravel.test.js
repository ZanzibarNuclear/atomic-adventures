import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import {
  buildTravelWorld,
  enumerateBarrierStandMoves,
  enumerateBarrierStandPositions,
  enumerateDefaultStandMoves,
  evaluateNeighborMove,
  offeredMoves,
  openingAllows,
} from './travelWorld.js'

const world = buildTravelWorld(mapData)

function moveLabel(move) {
  const { fromHex, toHex, fromPos, standKind } = move
  const at =
    standKind === 'barrier'
      ? `@(${Math.round(fromPos.x)},${Math.round(fromPos.y)})`
      : ''
  return `${fromHex.id}${at} → ${toHex.id}`
}

function assertGeometryAgreesWithResolveMove(move) {
  const { fromHex, toHex, path, result, hit, reachable } = move
  const label = moveLabel(move)

  if (hit && !openingAllows(hit.kind, hit.x, hit.y, world.ctx.openings)) {
    expect(result.blockedKind, label).toBe(hit.kind)
    expect(result.activeHexId, label).not.toBe(toHex.id)
    expect(reachable, label).toBe(false)
    return
  }

  if (result.blockedKind) {
    expect(reachable, label).toBe(false)
    return
  }

  expect(result.activeHexId, label).toBe(toHex.id)
  expect(result.stand, label).toEqual(move.toPos)
  expect(reachable, label).toBe(true)
  expect(path.length, label).toBeGreaterThanOrEqual(2)
}

function assertReachableMatchesResult(move) {
  const { reachable, result } = move
  const shouldReach = !result.blockedKind && result.activeHexId === move.toHex.id
  expect(reachable, moveLabel(move)).toBe(shouldReach)
}

function assertSegmentBlocksStopBeforeDestination(move) {
  const { fromHex, toHex, result, hit } = move
  if (!hit || openingAllows(hit.kind, hit.x, hit.y, world.ctx.openings)) {
    return
  }
  const label = moveLabel(move)
  expect(result.blockedKind, label).toBe(hit.kind)
  expect(result.activeHexId, label).not.toBe(toHex.id)
}

describe('Part I map — movement invariants (default stand)', () => {
  it('loads the world map with hexes, barriers, and openings', () => {
    expect(world.hexes.length).toBeGreaterThan(0)
    expect(world.ctx.barriers.length).toBeGreaterThan(0)
    expect(world.ctx.openings.length).toBeGreaterThan(0)
  })

  it('geometry and resolveMove agree on every adjacent default-stand move', () => {
    for (const move of enumerateDefaultStandMoves(world)) {
      assertGeometryAgreesWithResolveMove(move)
    }
  })

  it('reachable flag matches resolveMove for every adjacent default-stand move', () => {
    for (const move of enumerateDefaultStandMoves(world)) {
      assertReachableMatchesResult(move)
    }
  })

  it('every offered route and direct move is actually reachable', () => {
    for (const fromHex of world.hexes) {
      const fromPos = world.resolveStand(fromHex)
      const { routeMoves, directMoves } = offeredMoves(world, fromHex, fromPos)

      for (const move of routeMoves) {
        const toHex = world.hexById[move.toHexId]
        const { reachable } = evaluateNeighborMove(
          world,
          fromHex,
          toHex,
          fromPos,
        )
        expect(
          reachable,
          `${fromHex.id} route → ${move.toHexId} (${move.label})`,
        ).toBe(true)
      }

      for (const move of directMoves) {
        const toHex = world.hexById[move.toHexId]
        const { reachable } = evaluateNeighborMove(
          world,
          fromHex,
          toHex,
          fromPos,
        )
        expect(
          reachable,
          `${fromHex.id} direct → ${move.toHexId} (${move.label})`,
        ).toBe(true)
      }
    }
  })

  it('segment barrier blocks stop before the destination hex', () => {
    for (const move of enumerateDefaultStandMoves(world)) {
      assertSegmentBlocksStopBeforeDestination(move)
    }
  })
})

describe('Part I map — movement invariants (barrierStand)', () => {
  it('discovers barrierStand positions from blocked default-stand approaches', () => {
    const positions = [...enumerateBarrierStandPositions(world)]
    expect(positions.length).toBeGreaterThan(0)
  })

  it('geometry and resolveMove agree on every adjacent barrierStand move', () => {
    for (const move of enumerateBarrierStandMoves(world)) {
      assertGeometryAgreesWithResolveMove(move)
    }
  })

  it('reachable flag matches resolveMove for every adjacent barrierStand move', () => {
    for (const move of enumerateBarrierStandMoves(world)) {
      assertReachableMatchesResult(move)
    }
  })

  it('every offered route and direct move is reachable from each barrierStand', () => {
    for (const { fromHex, barrierStand } of enumerateBarrierStandPositions(
      world,
    )) {
      const { routeMoves, directMoves } = offeredMoves(
        world,
        fromHex,
        barrierStand,
      )

      for (const move of routeMoves) {
        const toHex = world.hexById[move.toHexId]
        const { reachable } = evaluateNeighborMove(
          world,
          fromHex,
          toHex,
          barrierStand,
        )
        expect(
          reachable,
          `${fromHex.id} @(${barrierStand.x},${barrierStand.y}) route → ${move.toHexId}`,
        ).toBe(true)
      }

      for (const move of directMoves) {
        const toHex = world.hexById[move.toHexId]
        const { reachable } = evaluateNeighborMove(
          world,
          fromHex,
          toHex,
          barrierStand,
        )
        expect(
          reachable,
          `${fromHex.id} @(${barrierStand.x},${barrierStand.y}) direct → ${move.toHexId}`,
        ).toBe(true)
      }
    }
  })

  it('segment barrier blocks stop before the destination hex', () => {
    for (const move of enumerateBarrierStandMoves(world)) {
      assertSegmentBlocksStopBeforeDestination(move)
    }
  })
})

describe('Part I map — walk simulation from start', () => {
  it('can explore reachable hexes without errors via offered moves', () => {
    const startId = mapData.start ?? mapData.journey?.[0]
    expect(startId).toBeTruthy()

    /** @type {Set<string>} */
    const visited = new Set([startId])
    /** @type {string[]} */
    const queue = [startId]

    while (queue.length) {
      const hexId = queue.shift()
      const fromHex = world.hexById[hexId]
      const fromPos = world.resolveStand(fromHex)
      const { routeMoves, directMoves } = offeredMoves(world, fromHex, fromPos)

      for (const move of [...routeMoves, ...directMoves]) {
        const toHex = world.hexById[move.toHexId]
        const { result, reachable } = evaluateNeighborMove(
          world,
          fromHex,
          toHex,
          fromPos,
        )
        expect(reachable).toBe(true)
        expect(result.blockedKind).toBeNull()
        expect(result.activeHexId).toBe(toHex.id)

        if (!visited.has(toHex.id)) {
          visited.add(toHex.id)
          queue.push(toHex.id)
        }
      }
    }

    expect(visited.size).toBeGreaterThan(1)
  })
})
