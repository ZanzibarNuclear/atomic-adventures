/**
 * Barrier features for hex travel (fence, river, cliff, ravine, …).
 * Crossing is allowed only at authored openings (gate/hole, bridge/ford, …).
 * All moves — along a route or direct hex-to-hex — use the same path-based checks.
 */


import {
  BARRIER_STAND_INSET,
  standBeforeBarrierHit,
} from './useBarrierStand.js'
import { resolveAvatarPosition, hasLandmarkMarker } from './useAvatarStand.js'
import { axialToPixel, hexCorners, hexDistance } from './useHexGeometry.js'
import { isWestOfRiverAt } from './usePassageCrossing.js'

export { travelOpenings } from './useBarrierOpenings.js'
const PATH_ORIGIN_EPS = 0.02

/** Which point-feature kinds allow crossing each barrier kind. */
export const BARRIER_OPENINGS = {
  fence: ['gate', 'hole'],
  river: ['bridge', 'ford'],
  cliff: ['stair'],
  ravine: ['bridge'],
}

export const BARRIER_KINDS = Object.keys(BARRIER_OPENINGS)

/** Point features — not drawable / routable polylines. */
export const BARRIER_OPENING_KINDS = new Set(
  Object.values(BARRIER_OPENINGS).flat(),
)

function allowedOpenings(kind) {
  return new Set(BARRIER_OPENINGS[kind] ?? [])
}

/** Do segments AB and CD intersect (strict crossing, not collinear touch)? */
export function segmentsCross(a, b, c, d) {
  const ccw = (p, q, r) => (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x)
  const d1 = ccw(c, d, a)
  const d2 = ccw(c, d, b)
  const d3 = ccw(a, b, c)
  const d4 = ccw(a, b, d)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** Intersection of segment AB with segment CD; t is param along AB in [0, 1]. */
export function segmentIntersection(a, b, c, d) {
  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (Math.abs(denom) < 1e-9) return null
  const t =
    ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom
  const u =
    ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
    t,
  }
}

/** All barrier polylines from feature models. */
export function barrierSegments(featureModels) {
  const segs = []
  for (const m of featureModels) {
    if (!BARRIER_KINDS.includes(m.kind)) continue
    for (let i = 0; i < m.points.length - 1; i++) {
      segs.push({ a: m.points[i], b: m.points[i + 1], kind: m.kind })
    }
  }
  return segs
}

export function fenceSegments(featureModels) {
  return barrierSegments(featureModels).filter((s) => s.kind === 'fence')
}

export function riverSegments(featureModels) {
  return barrierSegments(featureModels).filter((s) => s.kind === 'river')
}

export function openingAllows(kind, x, y, openings) {
  const allowed = allowedOpenings(kind)
  return openings.some((o) => {
    if (!allowed.has(o.kind)) return false
    const r = o.r ?? 12
    if (Math.hypot(x - o.x, y - o.y) > r) return false
    // River openings sit on the barrier line — reject shortcut chords that
    // cross the river at a different y but fall inside the opening disc.
    if (kind === 'river' && Math.abs(y - o.y) > r * 0.6) return false
    return true
  })
}

function barrierList(ctx) {
  return ctx.barriers ?? [...(ctx.fences ?? []), ...(ctx.rivers ?? [])]
}

/** Signed area — which side of line AB point P lies on. */
export function sideOfLine(p, a, b) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
}

/**
 * True when walk segment AB crosses barrier segment CD (endpoints on opposite sides).
 * Ignores grazing / parallel walks that stay on one side of the barrier line.
 */
export function pathCrossesBarrier(a, b, c, d) {
  const sa = sideOfLine(a, c, d)
  const sb = sideOfLine(b, c, d)
  const eps = 1e-3
  if (Math.abs(sa) <= eps && Math.abs(sb) <= eps) return false
  if (Math.abs(sa) <= eps || Math.abs(sb) <= eps) {
    return segmentIntersection(a, b, c, d) != null
  }
  return sa * sb < 0
}

/** True when chord AB crosses any segment of `kind`. */
export function chordCrossesBarrierKind(fromPos, toPos, kind, ctx) {
  for (const seg of ctx.barriers ?? []) {
    if (seg.kind !== kind) continue
    if (pathCrossesBarrier(fromPos, toPos, seg.a, seg.b)) return true
  }
  return false
}

function moveHexContext(fromHex, toHex) {
  if (!fromHex?.id || !toHex?.id) return null
  return { fromHexId: fromHex.id, toHexId: toHex.id }
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function sharedHexEdge(fromHex, toHex, size) {
  if (!fromHex || !toHex || hexDistance(fromHex, toHex) !== 1) return null
  const fromCenter = axialToPixel(fromHex.q, fromHex.r, size)
  const toCenter = axialToPixel(toHex.q, toHex.r, size)
  const fromCorners = hexCorners(fromCenter.x, fromCenter.y, size)
  const toCorners = hexCorners(toCenter.x, toCenter.y, size)
  const shared = []
  for (const a of fromCorners) {
    for (const b of toCorners) {
      if (pointDistance(a, b) < 1e-6) {
        shared.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
      }
    }
  }
  if (shared.length !== 2) return null
  return { a: shared[0], b: shared[1], toCenter }
}

function sampleSharedEdge(edge, toHex, size) {
  if (!edge) return []
  const nudges = [0.15, 0.3, 0.5, 0.7, 0.85]
  const inset = Math.max(2, size * 0.08)
  return nudges.map((t) => {
    const edgePoint = {
      x: edge.a.x + (edge.b.x - edge.a.x) * t,
      y: edge.a.y + (edge.b.y - edge.a.y) * t,
    }
    const vx = edge.toCenter.x - edgePoint.x
    const vy = edge.toCenter.y - edgePoint.y
    const len = Math.hypot(vx, vy) || 1
    return {
      edgePoint,
      insidePoint: {
        x: edgePoint.x + (vx / len) * inset,
        y: edgePoint.y + (vy / len) * inset,
      },
    }
  })
}

function pathClear(path, ctx, moveCtx = null) {
  return firstBlockedOnPath(path, ctx, moveCtx) == null
}

function approachCtx(ctx) {
  if (!ctx?.allOpenings) return ctx
  return { ...ctx, openings: ctx.allOpenings }
}

function authoredStandApproachesOpening(authored, hit, ctx) {
  const openings = ctx?.allOpenings ?? ctx?.openings ?? []
  const allowed = allowedOpenings(hit?.kind)
  return openings.some((o) => {
    if (!allowed.has(o.kind)) return false
    const r = o.r ?? 12
    return Math.hypot(authored.x - o.x, authored.y - o.y) <= r
  })
}

function standBeforeFirstHit(path, ctx, moveCtx = null) {
  const hit = firstBlockedOnPath(path, ctx, moveCtx)
  if (!hit) return null
  const segStart = path[hit.segIndex] ?? path[0]
  return {
    stand: standBeforeBarrierHit(segStart, hit, {
      inset: BARRIER_STAND_INSET[hit.kind] ?? BARRIER_STAND_INSET.fence,
    }),
    hit,
  }
}

function mostlyParallelToBarrier(fromPos, toPos, hit) {
  if (!fromPos || !toPos || !hit) return false
  const vx = toPos.x - fromPos.x
  const vy = toPos.y - fromPos.y
  const wx = hit.b.x - hit.a.x
  const wy = hit.b.y - hit.a.y
  const vLen = Math.hypot(vx, vy)
  const wLen = Math.hypot(wx, wy)
  if (!vLen || !wLen) return false
  return Math.abs((vx * wx + vy * wy) / (vLen * wLen)) >= 0.6
}

function sameSideOfHit(a, b, hit) {
  if (!a || !b || !hit) return false
  const sa = sideOfLine(a, hit.a, hit.b)
  const sb = sideOfLine(b, hit.a, hit.b)
  const eps = 1e-3
  return Math.abs(sa) <= eps || Math.abs(sb) <= eps || sa * sb > 0
}

function resolveSharedEdgeMove({
  fromHex,
  toHex,
  fromPos,
  toPos,
  ctx,
  hexAtPoint,
  size,
  hit,
}) {
  if (!size || !hexAtPoint) return null
  const edge = sharedHexEdge(fromHex, toHex, size)
  if (!edge) return null
  const moveCtx = moveHexContext(fromHex, toHex)
  const preferred = toHex?.standAt ? resolveAvatarPosition(toHex, size) : null

  for (const candidate of sampleSharedEdge(edge, toHex, size)) {
    if (!mostlyParallelToBarrier(fromPos, candidate.insidePoint, hit)) continue
    const entryPath = [fromPos, candidate.insidePoint]
    if (!pathClear(entryPath, ctx, moveCtx)) continue
    if (hexAtPoint(candidate.insidePoint, toHex.id) !== toHex.id) continue

    if (
      preferred &&
      pathClear([candidate.insidePoint, preferred], ctx, moveCtx)
    ) {
      return {
        stand: preferred,
        activeHexId: toHex.id,
        blockedKind: null,
        path: [fromPos, candidate.insidePoint, preferred],
      }
    }

    if (toPos && pathClear([candidate.insidePoint, toPos], ctx, moveCtx)) {
      return {
        stand: toPos,
        activeHexId: toHex.id,
        blockedKind: null,
        path: [fromPos, candidate.insidePoint, toPos],
      }
    }

    return {
      stand: candidate.insidePoint,
      activeHexId: toHex.id,
      blockedKind: null,
      path: entryPath,
    }
  }
  return null
}

/** First barrier hit along a polyline path; null when none. */
export function firstBlockedOnPath(path, ctx, moveCtx = null) {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (const seg of barrierList(ctx)) {
      const cross = segmentIntersection(a, b, seg.a, seg.b)
      if (!cross || cross.t < PATH_ORIGIN_EPS) continue
      if (!pathCrossesBarrier(a, b, seg.a, seg.b)) continue
      if (!openingAllows(seg.kind, cross.x, cross.y, ctx.openings)) {
        return { ...cross, kind: seg.kind, segIndex: i, a: seg.a, b: seg.b }
      }
    }
  }
  return null
}

/**
 * First barrier hit along `path` whose intersection lies in `hexId`.
 * Used for movement options — barriers in neighboring hexes are ignored.
 */
export function firstBlockedOnPathInHex(path, ctx, hexId, hexAtPoint, moveCtx = null) {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (const seg of barrierList(ctx)) {
      const cross = segmentIntersection(a, b, seg.a, seg.b)
      if (!cross || cross.t < PATH_ORIGIN_EPS) continue
      if (!pathCrossesBarrier(a, b, seg.a, seg.b)) continue
      if (!openingAllows(seg.kind, cross.x, cross.y, ctx.openings)) {
        if (hexAtPoint({ x: cross.x, y: cross.y }, hexId) === hexId) {
          return { ...cross, kind: seg.kind, segIndex: i, a: seg.a, b: seg.b }
        }
      }
    }
  }
  return null
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
 * Whether a neighbor should appear as a movement option.
 * All adjacent hexes are offered unless a barrier in the current hex blocks exit.
 */
export function canOfferNeighbor({
  fromHex,
  toHex,
  fromPos,
  toPos,
  path,
  ctx,
  hexAtPoint,
}) {
  if (!fromHex?.id) return false
  const walkPath = path ?? [fromPos, toPos]
  return blockedLeavingDepartureHex(
    walkPath,
    fromHex.id,
    ctx,
    hexAtPoint,
    moveHexContext(fromHex, toHex),
  ) === null
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

/** Midpoint along a route polyline while still inside `hexId` (avoids hex-edge stops). */
export function routeStandInHex(path, hexId, hexAtPoint) {
  const inHex = []
  for (const p of path) {
    if (hexAtPoint(p, hexId) === hexId) inHex.push(p)
  }
  if (!inHex.length) return null
  return inHex[Math.floor(inHex.length / 2)]
}

/** Last sample along `path` inside `hexId` — route dead-ends (e.g. drive at a river bank). */
export function pathEndInHex(path, hexId, hexAtPoint) {
  for (let i = path.length - 1; i >= 0; i--) {
    if (hexAtPoint(path[i], hexId) === hexId) return path[i]
  }
  return null
}

/**
 * Where to stand after an unblocked move: route midpoint when the path passes
 * through the hex, route endpoint when it dead-ends at an authored standAt hex,
 * otherwise the requested destination (hex center for direct steps).
 */
export function resolveArrivalStand(walkPath, toHex, toPos, hexAtPoint, opts = {}) {
  const stand = toHex?.standAt
  const { size, fromPos, fromHex, ctx } = opts
  const barriers = ctx?.barriers ?? ctx ?? []

  if (stand?.x != null && stand?.y != null && stand.from == null) {
    const authored = { x: stand.x, y: stand.y }
    if (walkPath.length > 2 && ctx) {
      const standCtx = approachCtx(ctx)
      const routeStand = routeStandInHex(walkPath, toHex.id, hexAtPoint)
      const blockedFromStart = standBeforeFirstHit(
        [fromPos, authored],
        standCtx,
        moveHexContext(fromHex, toHex),
      )
      if (
        blockedFromStart &&
        authoredStandApproachesOpening(authored, blockedFromStart.hit, ctx)
      ) {
        return authored
      }
      if (
        blockedFromStart &&
        hexAtPoint(blockedFromStart.stand, toHex.id) === toHex.id
      ) {
        return blockedFromStart.stand
      }
      const blockedFromRouteStand = routeStand
        ? standBeforeFirstHit(
          [routeStand, authored],
          standCtx,
          moveHexContext(fromHex, toHex),
        )
        : null
      if (
        blockedFromRouteStand &&
        authoredStandApproachesOpening(authored, blockedFromRouteStand.hit, ctx)
      ) {
        return authored
      }
      if (
        routeStand &&
        blockedFromRouteStand &&
        hexAtPoint(blockedFromRouteStand.stand, toHex.id) === toHex.id
      ) {
        return blockedFromRouteStand.stand
      }
    }
    return authored
  }

  // Route dead-ends at a landmark stand (e.g. utility station driveway).
  if (stand?.from === 'landmark' && size != null && walkPath.length > 2) {
    const last = walkPath[walkPath.length - 1]
    const bankArrival = last && isWestOfRiverAt(last, barriers)
    if (!bankArrival) {
      return resolveAvatarPosition(toHex, size)
    }
  }

  if (stand?.from === 'landmark' && size != null && walkPath.length <= 2) {
    return resolveAvatarPosition(toHex, size)
  }

  if (walkPath.length <= 2) return toPos
  const last = walkPath[walkPath.length - 1]
  if (
    toHex?.standAt &&
    toHex.id &&
    hexAtPoint(last, toHex.id) === toHex.id
  ) {
    return { x: last.x, y: last.y }
  }
  return routeStandInHex(walkPath, toHex.id, hexAtPoint) ?? toPos
}

/**
 * Whether a direct walk from `from` to `to` is blocked by any barrier (river, fence, …).
 * Uses path intersection first; falls back to opposite-side checks when the chord
 * misses curved barrier geometry.
 */
export function barrierBlocksReach(from, to, ctx) {
  if (firstBlockedOnPath([from, to], ctx)) return true

  for (const seg of barrierList(ctx)) {
    const sa = sideOfLine(from, seg.a, seg.b)
    const sb = sideOfLine(to, seg.a, seg.b)
    const eps = 1e-3
    if (Math.abs(sa) <= eps || Math.abs(sb) <= eps) continue
    if (sa * sb >= 0) continue

    const cross = segmentIntersection(from, to, seg.a, seg.b)
    if (!cross) return true
    if (!openingAllows(seg.kind, cross.x, cross.y, ctx.openings)) return true
  }
  return false
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
 * Resolve a move: walk `path` until a barrier stops the avatar.
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
}) {
  const walkPath = path ?? [fromPos, toPos]
  const moveCtx = moveHexContext(fromHex, toHex)
  const fallbackHexId = toHex?.id ?? fromHex?.id

  if (walkPath.length < 2) {
    return {
      stand: toPos,
      activeHexId: hexAtPoint(toPos, fallbackHexId),
      blockedKind: null,
    }
  }

  const hit = firstBlockedOnPath(walkPath, ctx, moveCtx)
  let blockedKind = hit?.kind ?? null
  let stand

  if (hit) {
    if (walkPath.length <= 2) {
      const edgeMove = resolveSharedEdgeMove({
        fromHex,
        toHex,
        fromPos,
        toPos,
        ctx,
        hexAtPoint,
        size,
        hit,
      })
      if (edgeMove) return edgeMove
    }

    const authored =
      toHex?.standAt?.x != null &&
      toHex.standAt?.y != null &&
      toHex.standAt.from == null
        ? { x: toHex.standAt.x, y: toHex.standAt.y }
        : null
    if (authored && sameSideOfHit(fromPos, authored, hit)) {
      stand = authored
      blockedKind = null
    } else if (authored && authoredStandApproachesOpening(authored, hit, ctx)) {
      stand = authored
      blockedKind = null
    } else {
      const segStart = walkPath[hit.segIndex] ?? fromPos
      stand = standBeforeBarrierHit(segStart, hit, {
        inset: BARRIER_STAND_INSET[hit.kind] ?? BARRIER_STAND_INSET.fence,
      })
    }
  } else {
    stand = resolveArrivalStand(walkPath, toHex, toPos, hexAtPoint, {
      size,
      fromHex,
      fromPos,
      ctx,
    })
  }

  // Blocked at a barrier — active hex follows where the avatar actually stands.
  const activeHexId = hexAtPoint(stand, fallbackHexId)

  return {
    stand,
    activeHexId,
    blockedKind,
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
  })
  return result.activeHexId === toHex.id
}

/** Whether the player fully arrives at the destination stand with no barrier stop. */
export function canReachNeighbor({
  fromHex,
  toHex,
  fromPos,
  toPos,
  path,
  ctx,
  hexAtPoint,
  size,
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
  })
  return !result.blockedKind && result.activeHexId === toHex.id
}
