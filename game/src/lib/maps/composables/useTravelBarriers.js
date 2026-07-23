/**
 * Barrier features for hex travel (fence, stream, river, cliff, ravine, …).
 * Direct inter-hex movement never uses passage openings. Authored routes may
 * opt into currently available openings when the route path crosses at one.
 */


import {
  resolveAvatarPosition,
  hasLandmarkMarker,
} from './useAvatarStand.js'
import {
  BARRIER_KINDS,
  BARRIER_OPENINGS,
  BARRIER_OPENING_KINDS,
  barrierSegments,
  chordCrossesBarrierKind as barrierChordCrossesBarrierKind,
  fenceSegments,
  firstBlockedOnPath as firstBarrierHitOnPath,
  firstBlockedOnPathInHex as firstBarrierHitOnPathInHex,
  pathCrossesBarrier as segmentPathCrossesBarrier,
  riverSegments,
} from '../travel/barrierContext.js'
import { pathInHex as findPathInHex } from '../travel/pathInHex.js'
import {
  findReachableBorderEntry,
  resolveBlockedDeparture,
  resolveDestinationStand,
} from '../travel/arrivalStand.js'

export { travelOpenings } from './useBarrierOpenings.js'
export { segmentIntersection, segmentsCross, sideOfLine } from '../geometry/segments.js'
export { hexPolygon, pointInHexPolygon } from '../travel/hexPolygon.js'
export { pathEndInHex, resolveArrivalStand, routeStandInHex } from '../travel/arrivalStand.js'
export {
  BARRIER_KINDS,
  BARRIER_OPENINGS,
  BARRIER_OPENING_KINDS,
  WATER_BARRIER_KINDS,
  barrierSegments,
  fenceSegments,
  isWaterBarrier,
  riverSegments,
} from '../travel/barrierContext.js'
/**
 * True when walk segment AB crosses barrier segment CD (endpoints on opposite sides).
 * Ignores grazing / parallel walks that stay on one side of the barrier line.
 */
export function pathCrossesBarrier(a, b, c, d) {
  return segmentPathCrossesBarrier(a, b, c, d)
}

/** True when chord AB crosses any segment of `kind`. */
export function chordCrossesBarrierKind(fromPos, toPos, kind, ctx) {
  return barrierChordCrossesBarrierKind(fromPos, toPos, kind, ctx)
}

function moveHexContext(fromHex, toHex) {
  if (!fromHex?.id || !toHex?.id) return null
  return { fromHexId: fromHex.id, toHexId: toHex.id }
}

function pathClear(path, ctx, moveCtx = null) {
  return firstBlockedOnPath(path, ctx, moveCtx) == null
}

/**
 * Barrier-bounded walk inside one hex from `from` to `to` without crossing barriers.
 * Uses a cell-local graph search within the hex polygon (reachable sub-area).
 */
export function pathInHex(hex, from, to, ctx, size) {
  return findPathInHex(hex, from, to, ctx, size, pathClear)
}

/** First barrier hit along a polyline path; null when none. Ignores passage openings. */
export function firstBlockedOnPath(path, ctx, moveCtx = null) {
  return firstBarrierHitOnPath(path, ctx, moveCtx)
}

/**
 * First barrier hit along `path` whose intersection lies in `hexId`.
 * Used for movement options — barriers in neighboring hexes are ignored.
 */
export function firstBlockedOnPathInHex(path, ctx, hexId, hexAtPoint, moveCtx = null) {
  return firstBarrierHitOnPathInHex(path, ctx, hexId, hexAtPoint, moveCtx)
}

/**
 * Path samples from the stand until the walk exits fromHex (includes the
 * first sample outside the departure hex when present).
 */
export function pathInDepartureHex(path, fromHexId, hexAtPoint) {
  if (path.length < 2) return path
  const out = [path[0]]
  for (let i = 1; i < path.length; i++) {
    out.push(path[i])
    if (hexAtPoint(path[i], fromHexId) !== fromHexId) break
  }
  return out
}

/**
 * Barrier blocking exit from the departure hex along `path`, if any.
 * Barriers in neighboring hexes are ignored for movement options.
 */
export function blockedLeavingDepartureHex(path, fromHexId, ctx, hexAtPoint, moveCtx = null) {
  const sub = pathInDepartureHex(path, fromHexId, hexAtPoint)
  if (sub.length < 2) return null
  return firstBlockedOnPathInHex(sub, ctx, fromHexId, hexAtPoint, moveCtx)
}

/** True when any step of `path` strictly crosses a barrier segment (ignores openings). */
export function pathCrossesAnyBarrier(path, ctx) {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (const seg of ctx.barriers ?? []) {
      if (pathCrossesBarrier(a, b, seg.a, seg.b)) return seg.kind
    }
  }
  return null
}

/**
 * Whether a move along `path` is blocked. Returns barrier kind or null.
 * Same rules for route-following and direct hex-to-hex travel.
 */
export function moveBlocked(fromHex, toHex, path, ctx) {
  if (path.length < 2) return null
  const hit = firstBlockedOnPath(path, ctx, moveHexContext(fromHex, toHex))
  return hit?.kind ?? null
}

/** Convenience: straight walk from current stand to destination stand. */
export function moveBlockedBetween(fromHex, toHex, fromPos, toPos, ctx) {
  return moveBlocked(fromHex, toHex, [fromPos, toPos], ctx)
}

/** Samples along a route between two hex spans (inclusive). */
export function routeMoveSamples(model, fromSpan, toSpan) {
  const idxs = [
    fromSpan.startIdx,
    fromSpan.endIdx,
    toSpan.startIdx,
    toSpan.endIdx,
  ]
  return model.samples.slice(Math.min(...idxs), Math.max(...idxs) + 1)
}

/**
 * Whether a direct walk from `from` to `to` is blocked by any barrier (river, fence, …).
 * Uses path intersection first; falls back to opposite-side checks when the chord
 * misses curved barrier geometry.
 */
export function barrierBlocksReach(from, to, ctx) {
  return firstBlockedOnPath([from, to], ctx) != null
}

/** True when `stand` can reach the hex landmark stand without crossing a closed barrier. */
export function isLandmarkReachable(hex, stand, ctx, size) {
  if (!hasLandmarkMarker(hex)) return false
  const target = resolveAvatarPosition(hex, size)
  return !barrierBlocksReach(stand, target, ctx)
}

/** Whether a marked-route move should be hidden / rejected (departure hex only). */
export function isRouteMoveBlocked(fromHex, toHex, pathSamples, ctx, hexAtPoint) {
  if (!fromHex?.id || !hexAtPoint) {
    return moveBlocked(fromHex, toHex, pathSamples, ctx) !== null
  }
  return blockedLeavingDepartureHex(pathSamples, fromHex.id, ctx, hexAtPoint) !== null
}

/**
 * Resolve a move: reach the shared border (step 1), then stand in the destination hex (step 2).
 * Active hex = whichever hex contains the final stand point.
 */
export function resolveMove({
  fromHex,
  toHex,
  fromPos,
  toPos,
  path,
  ctx,
  hexAtPoint,
  size,
  allowOpenings = false,
}) {
  const travelCtx = allowOpenings
    ? { ...ctx, allowOpenings: true, allowOpeningHexId: fromHex?.id ?? null }
    : ctx
  const walkPath = path ?? [fromPos, toPos]
  const fallbackHexId = toHex?.id ?? fromHex?.id

  if (walkPath.length < 2) {
    return {
      stand: toPos,
      activeHexId: hexAtPoint(toPos, fallbackHexId),
      blockedKind: null,
    }
  }

  const border = findReachableBorderEntry({
    fromHex,
    toHex,
    fromPos,
    toPos,
    walkPath,
    ctx: travelCtx,
    hexAtPoint,
    size,
  })

  if (!border) {
    return resolveBlockedDeparture({
      fromHex,
      fromPos,
      toPos,
      walkPath,
      ctx,
      hexAtPoint,
    })
  }

  const dest = resolveDestinationStand({
    entryPoint: border.entryPoint,
    fromHex,
    toHex,
    fromPos,
    toPos,
    walkPath,
    ctx: travelCtx,
    hexAtPoint,
    size,
  })

  return {
    stand: dest.stand,
    activeHexId: hexAtPoint(dest.stand, toHex.id),
    blockedKind: dest.blockedKind,
    path:
      dest.blockedKind != null
        ? border.approachPath
        : [...border.approachPath, dest.stand],
  }
}

/** Whether a move ends on the destination hex (may stop at an in-hex barrier). */
export function canEnterNeighbor({
  fromHex,
  toHex,
  fromPos,
  toPos,
  path,
  ctx,
  hexAtPoint,
  size,
  allowOpenings = false,
}) {
  const result = resolveMove({
    fromHex,
    toHex,
    fromPos,
    toPos,
    path,
    ctx,
    hexAtPoint,
    size,
    allowOpenings,
  })
  return result.activeHexId === toHex.id
}
