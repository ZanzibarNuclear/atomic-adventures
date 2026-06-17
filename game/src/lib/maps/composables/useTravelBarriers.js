/**
 * Barrier features for hex travel (fence, river, cliff, ravine, …).
 * Inter-hex movement never uses passage openings — those are for in-hex
 * `crossPassage` only. See docs/designs/hexcrawling.md.
 */


import {
  BARRIER_STAND_INSET,
  standBeforeBarrierHit,
} from './useBarrierStand.js'
import {
  resolveAvatarPosition,
  hexCenterStand,
  hasLandmarkMarker,
} from './useAvatarStand.js'
import { axialToPixel, hexCorners, hexDistance } from './useHexGeometry.js'

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
  return matchingOpening(kind, x, y, openings) != null
}

function matchingOpening(kind, x, y, openings) {
  const allowed = allowedOpenings(kind)
  return openings.find((o) => {
    if (!allowed.has(o.kind)) return null
    const r = o.r ?? 12
    if (Math.hypot(x - o.x, y - o.y) > r) return null
    // River openings sit on the barrier line — reject shortcut chords that
    // cross the river at a different y but fall inside the opening disc.
    if (kind === 'river' && Math.abs(y - o.y) > r * 0.6) return null
    return o
  }) ?? null
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

function pointToSegmentDistance(p, seg) {
  const vx = seg.b.x - seg.a.x
  const vy = seg.b.y - seg.a.y
  const wx = p.x - seg.a.x
  const wy = p.y - seg.a.y
  const denom = vx * vx + vy * vy || 1
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / denom))
  const q = { x: seg.a.x + vx * t, y: seg.a.y + vy * t }
  return pointDistance(p, q)
}

function barrierClearance(p, ctx) {
  const barriers = barrierList(ctx)
  if (!barriers.length) return Infinity
  return Math.min(...barriers.map((seg) => pointToSegmentDistance(p, seg)))
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

function closedBarrierCtx(ctx) {
  return ctx ? { ...ctx, openings: [] } : ctx
}

/** Context for adjacent hex travel — barriers block; openings do not apply. */
function interHexTravelCtx(ctx) {
  return closedBarrierCtx(ctx)
}

function standBeforeFirstHit(path, ctx, moveCtx = null) {
  const hit = firstBlockedOnPath(path, interHexTravelCtx(ctx), moveCtx)
  if (!hit) return null
  const segStart = path[hit.segIndex] ?? path[0]
  return {
    stand: standBeforeBarrierHit(segStart, hit, {
      inset: BARRIER_STAND_INSET[hit.kind] ?? BARRIER_STAND_INSET.fence,
    }),
    hit,
  }
}

function samePoint(a, b) {
  return !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6
}

function interpolate(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }
}

function hexInteriorCandidates(fromHex, toHex, fromPos, hexAtPoint, size, ctx) {
  if (!toHex || !fromPos || !hexAtPoint || size == null) return []
  const edge = sharedHexEdge(fromHex, toHex, size)
  const center = hexCenterStand(toHex, size)
  const candidates = []
  const add = (point) => {
    if (!point) return
    if (hexAtPoint(point, toHex.id) !== toHex.id) return
    if (candidates.some((candidate) => samePoint(candidate.point, point))) return
    candidates.push({
      point,
      distance: pointDistance(fromPos, point),
      clearance: barrierClearance(point, ctx),
    })
  }

  if (edge) {
    for (const sample of sampleSharedEdge(edge, toHex, size)) {
      for (const t of [0.85, 0.7, 0.55, 0.4, 0.25]) {
        add(interpolate(sample.insidePoint, center, t))
      }
    }
  }

  const radius = size * 0.42
  for (const angle of [0, 60, 120, 180, 240, 300]) {
    const rad = (angle * Math.PI) / 180
    add({
      x: center.x + Math.cos(rad) * radius,
      y: center.y + Math.sin(rad) * radius,
    })
  }
  const gridStep = size / 4
  for (let dx = -size * 0.75; dx <= size * 0.75; dx += gridStep) {
    for (let dy = -size * 0.75; dy <= size * 0.75; dy += gridStep) {
      add({ x: center.x + dx, y: center.y + dy })
    }
  }
  add(center)

  return candidates
    .sort((a, b) => b.clearance - a.clearance || b.distance - a.distance)
    .map((candidate) => candidate.point)
}

function nearSharedEdge(point, edge, size) {
  if (!point || !edge || size == null) return false
  const d = pointToSegmentDistance(point, { a: edge.a, b: edge.b })
  return d <= size * 0.2
}

function standInDestinationHex(point, toHex, hexAtPoint) {
  return !!point && !!toHex?.id && hexAtPoint(point, toHex.id) === toHex.id
}

/**
 * Step 1: find a path from the current stand into the destination hex that
 * does not cross any barrier. Tries the movement polyline first, then shared-edge samples.
 */
function findReachableBorderEntry({
  fromHex,
  toHex,
  fromPos,
  toPos,
  walkPath,
  ctx,
  hexAtPoint,
  size,
}) {
  if (!fromHex || !toHex || !fromPos || !ctx || !hexAtPoint || size == null) {
    return null
  }
  const travelCtx = interHexTravelCtx(ctx)
  const moveCtx = moveHexContext(fromHex, toHex)
  const edge = sharedHexEdge(fromHex, toHex, size)

  if (walkPath.length >= 2 && pathClear(walkPath, travelCtx, moveCtx)) {
    for (let i = walkPath.length - 1; i >= 1; i--) {
      const point = walkPath[i]
      if (!standInDestinationHex(point, toHex, hexAtPoint)) continue
      if (!edge || nearSharedEdge(point, edge, size)) {
        return { entryPoint: point, approachPath: walkPath.slice(0, i + 1) }
      }
    }
  }

  const chordTargets = []
  if (
    toPos &&
    standInDestinationHex(toPos, toHex, hexAtPoint) &&
    nearSharedEdge(toPos, edge, size)
  ) {
    chordTargets.push(toPos)
  }
  if (edge) {
    for (const sample of sampleSharedEdge(edge, toHex, size)) {
      chordTargets.push(sample.insidePoint)
    }
  }
  for (const target of chordTargets) {
    const approachPath = [fromPos, target]
    if (pathClear(approachPath, travelCtx, moveCtx)) {
      return { entryPoint: target, approachPath }
    }
  }

  if (edge) {
    for (const sample of sampleSharedEdge(edge, toHex, size)) {
      for (let t = 0.1; t < 1; t += 0.1) {
        const p = interpolate(fromPos, sample.insidePoint, t)
        if (!standInDestinationHex(p, toHex, hexAtPoint)) continue
        const approachPath = [fromPos, p]
        if (pathClear(approachPath, travelCtx, moveCtx)) {
          return { entryPoint: p, approachPath }
        }
      }
    }
  }
  return null
}

/**
 * Step 2: from a point just inside the destination hex, pick where to stand.
 * Authored standAt, then center, then interior samples on the accessible side of barriers.
 */
function resolveDestinationStand({
  entryPoint,
  fromHex,
  toHex,
  fromPos,
  toPos,
  walkPath,
  ctx,
  hexAtPoint,
  size,
}) {
  const travelCtx = interHexTravelCtx(ctx)
  const moveCtx = moveHexContext(fromHex, toHex)

  if (toPos && samePoint(entryPoint, toPos)) {
    return { stand: entryPoint, blockedKind: null }
  }

  const routeStand =
    walkPath.length > 2
      ? resolveArrivalStand(walkPath, toHex, toPos, hexAtPoint, {
        size,
        fromHex,
        fromPos,
        ctx: travelCtx,
      })
      : null

  const authored = toHex?.standAt ? resolveAvatarPosition(toHex, size) : null
  const center = hexCenterStand(toHex, size)
  const preferred = [routeStand, authored, toPos, center].filter(
    (pt, i, arr) =>
      pt &&
      standInDestinationHex(pt, toHex, hexAtPoint) &&
      !arr.slice(0, i).some((other) => samePoint(other, pt)),
  )

  for (const target of preferred) {
    if (pathClear([entryPoint, target], travelCtx, moveCtx)) {
      return { stand: target, blockedKind: null }
    }
  }

  for (const pt of hexInteriorCandidates(
    fromHex,
    toHex,
    entryPoint,
    hexAtPoint,
    size,
    travelCtx,
  )) {
    if (preferred.some((p) => samePoint(p, pt))) continue
    if (pathClear([entryPoint, pt], travelCtx, moveCtx)) {
      return { stand: pt, blockedKind: null }
    }
  }

  for (const target of preferred) {
    const blocked = standBeforeFirstHit([entryPoint, target], travelCtx, moveCtx)
    if (
      blocked &&
      standInDestinationHex(blocked.stand, toHex, hexAtPoint)
    ) {
      return { stand: blocked.stand, blockedKind: blocked.hit.kind }
    }
  }

  return { stand: entryPoint, blockedKind: null }
}

function resolveBlockedDeparture({
  fromHex,
  fromPos,
  toPos,
  walkPath,
  ctx,
  hexAtPoint,
}) {
  const travelCtx = interHexTravelCtx(ctx)
  const hit =
    firstBlockedOnPath(walkPath, travelCtx) ??
    firstBlockedOnPath([fromPos, toPos], travelCtx)
  if (!hit) {
    return {
      stand: fromPos,
      activeHexId: fromHex.id,
      blockedKind: null,
    }
  }
  const segStart = walkPath[hit.segIndex] ?? fromPos
  const stand = standBeforeBarrierHit(segStart, hit, {
    inset: BARRIER_STAND_INSET[hit.kind] ?? BARRIER_STAND_INSET.fence,
  })
  return {
    stand,
    activeHexId: hexAtPoint(stand, fromHex.id),
    blockedKind: hit.kind,
  }
}

/** First barrier hit along a polyline path; null when none. Ignores passage openings. */
export function firstBlockedOnPath(path, ctx, moveCtx = null) {
  const travelCtx = interHexTravelCtx(ctx)
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (const seg of barrierList(travelCtx)) {
      const cross = segmentIntersection(a, b, seg.a, seg.b)
      if (!cross || cross.t < PATH_ORIGIN_EPS) continue
      if (!pathCrossesBarrier(a, b, seg.a, seg.b)) continue
      return { ...cross, kind: seg.kind, segIndex: i, a: seg.a, b: seg.b }
    }
  }
  return null
}

/**
 * First barrier hit along `path` whose intersection lies in `hexId`.
 * Used for movement options — barriers in neighboring hexes are ignored.
 */
export function firstBlockedOnPathInHex(path, ctx, hexId, hexAtPoint, moveCtx = null) {
  const travelCtx = interHexTravelCtx(ctx)
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (const seg of barrierList(travelCtx)) {
      const cross = segmentIntersection(a, b, seg.a, seg.b)
      if (!cross || cross.t < PATH_ORIGIN_EPS) continue
      if (!pathCrossesBarrier(a, b, seg.a, seg.b)) continue
      if (hexAtPoint({ x: cross.x, y: cross.y }, hexId) === hexId) {
        return { ...cross, kind: seg.kind, segIndex: i, a: seg.a, b: seg.b }
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
  const { size } = opts

  if (stand?.x != null && stand?.y != null && stand.from == null) {
    return { x: stand.x, y: stand.y }
  }

  if (stand?.from === 'landmark' && size != null) {
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
}) {
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
    ctx,
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
    ctx,
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
