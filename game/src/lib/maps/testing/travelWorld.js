/**
 * Build the travel/barrier context from map YAML — same wiring as useOutdoorWorld,
 * without Vue. Used by map-wide movement tests.
 */

import { pixelToHex, hexDistance } from '../composables/useHexGeometry.js'
import {
  buildRouteModels,
  availableMoves,
  directNeighbors,
  buildMovePath,
} from '../composables/useRoutes.js'
import { resolveAvatarPosition, resolveNeighborStand } from '../composables/useAvatarStand.js'
import {
  BARRIER_OPENING_KINDS,
  barrierSegments,
  travelOpenings,
  resolveMove,
  canOfferNeighbor,
  canReachNeighbor,
  canEnterNeighbor,
  firstBlockedOnPath,
  openingAllows,
} from '../composables/useTravelBarriers.js'
import { hiddenOpeningsInHex } from '../composables/useBarrierOpenings.js'

export { openingAllows, firstBlockedOnPath }

/** @typedef {import('../composables/useTravelBarriers.js').resolveMove} ResolveMoveResult */

/**
 * @param {object} mapData — parsed map.yaml
 * @param {{ discoveredOpenings?: string[] }} [opts]
 */
export function buildTravelWorld(mapData, opts = {}) {
  const hexes = mapData.hexes ?? []
  const hexById = Object.fromEntries(hexes.map((h) => [h.id, h]))
  const size = mapData.size ?? 44
  const features = mapData.features ?? []
  const routes = mapData.routes ?? []
  const discoveredOpenings = opts.discoveredOpenings ?? []

  const routeModels = buildRouteModels(routes, hexById, hexes, size)
  const mapFeatures = features.filter((f) => !BARRIER_OPENING_KINDS.has(f.kind))
  const featureModels = buildRouteModels(mapFeatures, hexById, hexes, size)
  const ctx = {
    barriers: barrierSegments(featureModels),
    openings: travelOpenings(features, { hexById, size, discoveredOpenings }),
  }

  const hexCoordMap = new Map(hexes.map((h) => [`${h.q},${h.r}`, h.id]))

  function hexAtPoint(pt, fallbackHexId) {
    const { q, r } = pixelToHex(pt.x, pt.y, size)
    return hexCoordMap.get(`${q},${r}`) ?? fallbackHexId
  }

  function resolveStand(toHex, fromHex, fromPos) {
    if (fromHex && fromPos) {
      return resolveNeighborStand(fromHex, toHex, fromPos, size, ctx)
    }
    return resolveAvatarPosition(toHex, size)
  }

  return {
    mapData,
    hexes,
    hexById,
    size,
    routeModels,
    featureModels,
    ctx,
    hexAtPoint,
    resolveStand,
    discoveredOpenings,
    revealOpening(id) {
      if (!discoveredOpenings.includes(id)) discoveredOpenings.push(id)
      ctx.openings = travelOpenings(features, {
        hexById,
        size,
        discoveredOpenings,
      })
    },
    searchInHex(hexId) {
      const hidden = hiddenOpeningsInHex(features, hexId, discoveredOpenings)
      for (const f of hidden) {
        if (!discoveredOpenings.includes(f.id)) discoveredOpenings.push(f.id)
      }
      ctx.openings = travelOpenings(features, {
        hexById,
        size,
        discoveredOpenings,
      })
      return hidden.map((f) => f.id)
    },
  }
}

export function adjacentHexes(fromHex, hexes) {
  return hexes.filter((h) => hexDistance(fromHex, h) === 1)
}

export function buildTravelOpts(world, fromHex, fromPos) {
  return {
    fromHex,
    hexById: world.hexById,
    size: world.size,
    barriers: world.ctx,
    fromPos,
    resolveStand: world.resolveStand,
    hexAtPoint: world.hexAtPoint,
    routeModels: world.routeModels,
  }
}

/** Route + direct moves the game would offer from `fromHex` at `fromPos`. */
export function offeredMoves(world, fromHex, fromPos) {
  const travelOpts = buildTravelOpts(world, fromHex, fromPos)
  const routeMoves = availableMoves(fromHex.id, world.routeModels, travelOpts)
  const onRoute = routeMoves.map((m) => m.toHexId)
  const direct = directNeighbors(
    fromHex.id,
    world.hexes,
    world.hexById,
    onRoute,
    world.size,
    world.ctx,
    fromPos,
    (toHex, from, pos) => world.resolveStand(toHex, from ?? fromHex, pos ?? fromPos),
    world.hexAtPoint,
  )
  return { routeMoves, directMoves: direct }
}

/**
 * Evaluate a single step to an adjacent hex using the same path rules as gameplay.
 */
export function evaluateNeighborMove(world, fromHex, toHex, fromPos) {
  const toPos = world.resolveStand(toHex, fromHex, fromPos)
  const routeLegs = availableMoves(fromHex.id, world.routeModels, null)
  const routeLeg = routeLegs.find((m) => m.toHexId === toHex.id)
  const path = buildMovePath(
    fromPos,
    fromHex,
    toHex,
    toPos,
    routeLeg,
    world.routeModels,
    { barriers: world.ctx, size: world.size },
  )

  const moveArgs = {
    fromHex,
    toHex,
    fromPos,
    toPos,
    path,
    ctx: world.ctx,
    hexAtPoint: world.hexAtPoint,
  }

  const result = resolveMove(moveArgs)
  const offerable = canOfferNeighbor(moveArgs)
  const enters = canEnterNeighbor(moveArgs)
  const reachable = canReachNeighbor(moveArgs)
  const hit = firstBlockedOnPath(path, world.ctx)

  return { path, result, offerable, enters, reachable, hit, toPos, routeLeg }
}

/** Every adjacent hex pair at each hex's default stand. */
export function* enumerateDefaultStandMoves(world) {
  for (const fromHex of world.hexes) {
    const fromPos = world.resolveStand(fromHex)
    for (const toHex of adjacentHexes(fromHex, world.hexes)) {
      yield {
        standKind: 'default',
        fromHex,
        toHex,
        fromPos,
        ...evaluateNeighborMove(world, fromHex, toHex, fromPos),
      }
    }
  }
}

function barrierStandKey(fromHexId, stand) {
  return `${fromHexId}@${Math.round(stand.x)},${Math.round(stand.y)}`
}

/**
 * Positions where a blocked move left the avatar at a barrier (matches applyMove rounding).
 * Uses activeHexId from resolveMove — after a fence block the player is on the destination hex.
 */
export function* enumerateBarrierStandPositions(world) {
  /** @type {Set<string>} */
  const seen = new Set()

  for (const fromHex of world.hexes) {
    const defaultPos = world.resolveStand(fromHex)
    for (const toHex of adjacentHexes(fromHex, world.hexes)) {
      const approach = evaluateNeighborMove(world, fromHex, toHex, defaultPos)
      if (!approach.result.blockedKind || !approach.result.stand) continue

      const activeHex = world.hexById[approach.result.activeHexId] ?? fromHex
      const barrierStand = {
        x: Math.round(approach.result.stand.x),
        y: Math.round(approach.result.stand.y),
      }
      const key = barrierStandKey(activeHex.id, barrierStand)
      if (seen.has(key)) continue
      seen.add(key)

      yield {
        fromHex: activeHex,
        barrierStand,
        blockedBy: approach.result.blockedKind,
        approachedVia: fromHex.id,
        attemptedHex: toHex.id,
      }
    }
  }
}

/** Every adjacent hex pair at each barrierStand position (post-block avatar location). */
export function* enumerateBarrierStandMoves(world) {
  for (const position of enumerateBarrierStandPositions(world)) {
    const { fromHex, barrierStand, blockedBy, approachedVia } = position
    for (const toHex of adjacentHexes(fromHex, world.hexes)) {
      yield {
        standKind: 'barrier',
        fromHex,
        toHex,
        fromPos: barrierStand,
        barrierStand,
        blockedBy,
        approachedVia,
        ...evaluateNeighborMove(world, fromHex, toHex, barrierStand),
      }
    }
  }
}
