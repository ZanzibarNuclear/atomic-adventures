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
import { blockedLeavingDepartureHex, routeStandInHex } from '../composables/useTravelBarriers.js'

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
  const { toHex, path, result, hit, enters, reachable } = move
  const label = moveLabel(move)

  expect(enters, label).toBe(result.activeHexId === toHex.id)

  if (hit && !openingAllows(hit.kind, hit.x, hit.y, world.ctx.openings)) {
    expect(result.blockedKind, label).toBe(hit.kind)
    expect(result.stand, label).not.toEqual(move.toPos)
    expect(result.activeHexId, label).toBe(
      world.hexAtPoint(result.stand, move.fromHex.id),
    )
    expect(enters, label).toBe(result.activeHexId === toHex.id)
    expect(reachable, label).toBe(false)
    return
  }

  if (result.blockedKind) {
    expect(reachable, label).toBe(false)
    return
  }

  expect(result.activeHexId, label).toBe(toHex.id)
  const pathEnd = path[path.length - 1]
  const midOnPath =
    path.length > 2 ? routeStandInHex(path, toHex.id, world.hexAtPoint) : null
  const authored =
    toHex.standAt?.x != null &&
    toHex.standAt?.y != null &&
    !toHex.standAt.from
      ? { x: toHex.standAt.x, y: toHex.standAt.y }
      : null
  const standOk =
    (result.stand.x === move.toPos.x && result.stand.y === move.toPos.y) ||
    (result.stand.x === pathEnd.x && result.stand.y === pathEnd.y) ||
    (midOnPath &&
      result.stand.x === midOnPath.x &&
      result.stand.y === midOnPath.y) ||
    (authored &&
      result.stand.x === authored.x &&
      result.stand.y === authored.y)
  expect(standOk, label).toBe(true)
  expect(enters, label).toBe(true)
  expect(reachable, label).toBe(true)
  expect(path.length, label).toBeGreaterThanOrEqual(2)
}

function assertReachableMatchesResult(move) {
  const { reachable, result } = move
  const shouldReach = !result.blockedKind && result.activeHexId === move.toHex.id
  expect(reachable, moveLabel(move)).toBe(shouldReach)
}

function assertOfferableMatchesResult(move) {
  const { offerable, fromHex, path } = move
  const blocked = blockedLeavingDepartureHex(
    path,
    fromHex.id,
    world.ctx,
    world.hexAtPoint,
  )
  expect(offerable, moveLabel(move)).toBe(blocked === null)
}

function assertSegmentBarrierBlock(move) {
  const { fromHex, toHex, result, hit } = move
  if (!hit || openingAllows(hit.kind, hit.x, hit.y, world.ctx.openings)) {
    return
  }
  const label = moveLabel(move)
  expect(result.blockedKind, label).toBe(hit.kind)
  expect(result.activeHexId, label).toBe(
    world.hexAtPoint(result.stand, fromHex.id),
  )
  expect(result.stand, label).not.toEqual(move.toPos)
}

describe('Part I map — known fence approaches', () => {
  it('lower-stand → south-pines: enters at fence, active hex is south-pines', () => {
    const from = world.hexById['lower-stand']
    const to = world.hexById['south-pines']
    const m = evaluateNeighborMove(world, from, to, world.resolveStand(from))

    expect(m.result.blockedKind).toBe('fence')
    expect(m.offerable).toBe(true)
    expect(m.enters).toBe(true)
    expect(m.reachable).toBe(false)
    expect(m.result.activeHexId).toBe('south-pines')
    expect(m.result.stand).not.toEqual(m.toPos)
  })

  it('offeredMoves includes lower-stand → south-pines (enter at fence)', () => {
    const from = world.hexById['lower-stand']
    const { directMoves, routeMoves } = offeredMoves(
      world,
      from,
      world.resolveStand(from),
    )
    const dests = [...routeMoves, ...directMoves].map((m) => m.toHexId)
    expect(dests).toContain('south-pines')
  })

  it('utility-yard → south-pines: interior move crosses no fence', () => {
    const from = world.hexById['utility-yard']
    const to = world.hexById['south-pines']
    const m = evaluateNeighborMove(world, from, to, world.resolveStand(from))

    expect(m.result.blockedKind).toBeNull()
    expect(m.enters).toBe(true)
    expect(m.reachable).toBe(true)
    expect(m.result.activeHexId).toBe('south-pines')
  })
})

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

  it('offerable flag matches departure-hex barrier rules for every adjacent move', () => {
    for (const move of enumerateDefaultStandMoves(world)) {
      assertOfferableMatchesResult(move)
    }
  })

  it('every offered route and direct move is offerable from the departure hex', () => {
    for (const fromHex of world.hexes) {
      const fromPos = world.resolveStand(fromHex)
      const { routeMoves, directMoves } = offeredMoves(world, fromHex, fromPos)

      for (const move of routeMoves) {
        const toHex = world.hexById[move.toHexId]
        const { offerable } = evaluateNeighborMove(
          world,
          fromHex,
          toHex,
          fromPos,
        )
        expect(
          offerable,
          `${fromHex.id} route → ${move.toHexId} (${move.label})`,
        ).toBe(true)
      }

      for (const move of directMoves) {
        const toHex = world.hexById[move.toHexId]
        const { offerable } = evaluateNeighborMove(
          world,
          fromHex,
          toHex,
          fromPos,
        )
        expect(
          offerable,
          `${fromHex.id} direct → ${move.toHexId} (${move.label})`,
        ).toBe(true)
      }
    }
  })

  it('segment barrier blocks land on the destination hex without reaching its stand', () => {
    for (const move of enumerateDefaultStandMoves(world)) {
      assertSegmentBarrierBlock(move)
    }
  })
})

describe('Part I map — movement invariants (barrierStand)', () => {
  it('discovers barrierStand positions from blocked default-stand approaches', () => {
    const positions = [...enumerateBarrierStandPositions(world)]
    expect(positions.length).toBeGreaterThan(0)
    expect(
      positions.some(
        (p) => p.fromHex.id === 'south-pines' && p.approachedVia === 'lower-stand',
      ),
    ).toBe(true)
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

  it('every offered route and direct move is offerable from each barrierStand', () => {
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
        const { offerable } = evaluateNeighborMove(
          world,
          fromHex,
          toHex,
          barrierStand,
        )
        expect(
          offerable,
          `${fromHex.id} @(${barrierStand.x},${barrierStand.y}) route → ${move.toHexId}`,
        ).toBe(true)
      }

      for (const move of directMoves) {
        const toHex = world.hexById[move.toHexId]
        const { offerable } = evaluateNeighborMove(
          world,
          fromHex,
          toHex,
          barrierStand,
        )
        expect(
          offerable,
          `${fromHex.id} @(${barrierStand.x},${barrierStand.y}) direct → ${move.toHexId}`,
        ).toBe(true)
      }
    }
  })

  it('segment barrier blocks land on the destination hex without reaching its stand', () => {
    for (const move of enumerateBarrierStandMoves(world)) {
      assertSegmentBarrierBlock(move)
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
        const { result, offerable, reachable } = evaluateNeighborMove(
          world,
          fromHex,
          toHex,
          fromPos,
        )
        expect(offerable).toBe(true)
        if (reachable) {
          expect(result.activeHexId).toBe(toHex.id)
        }

        if (reachable && result.activeHexId === toHex.id && !visited.has(toHex.id)) {
          visited.add(toHex.id)
          queue.push(toHex.id)
        }
      }
    }

    expect(visited.size).toBeGreaterThan(1)
  })
})
