/**
 * Barrier features for hex travel (fence, river, cliff, ravine, …).
 * Inter-hex movement never uses passage openings — those are for in-hex
 * `crossPassage` only. See docs/design/hex-crawling.md.
 */


import {
  BARRIER_STAND_INSET,
  FENCE_LINE_MAX_DIST,
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
const BARRIER_JUNCTION_CACHE = new WeakMap()

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

function hasSafeBarrierClearance(point, barriers) {
  for (const seg of barriers ?? []) {
    const inset =
      BARRIER_STAND_INSET[seg.kind] ?? BARRIER_STAND_INSET.fence
    if (pointToSegmentDistance(point, seg) < inset) return false
  }
  return true
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
  const dx = Math.abs(hit.b.x - hit.a.x)
  const dy = Math.abs(hit.b.y - hit.a.y)
  const inset =
    hit.kind === 'fence' && dx > dy
      ? FENCE_LINE_MAX_DIST + 8
      : BARRIER_STAND_INSET[hit.kind] ?? BARRIER_STAND_INSET.fence
  return {
    stand: standBeforeBarrierHit(segStart, hit, {
      inset,
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
  const polygon = hexPolygon(toHex, size)
  const boundarySegments = polygon.map((a, index) => ({
    a,
    b: polygon[(index + 1) % polygon.length],
  }))
  const candidates = []
  const add = (point) => {
    if (!point) return
    if (hexAtPoint(point, toHex.id) !== toHex.id) return
    if (candidates.some((candidate) => samePoint(candidate.point, point))) return
    candidates.push({
      point,
      distance: pointDistance(fromPos, point),
      clearance: barrierClearance(point, ctx),
      boundaryClearance: Math.min(
        ...boundarySegments.map((seg) => pointToSegmentDistance(point, seg)),
      ),
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
    .sort(
      (a, b) =>
        Math.min(b.clearance, b.boundaryClearance) -
          Math.min(a.clearance, a.boundaryClearance) ||
        b.clearance - a.clearance ||
        b.distance - a.distance,
    )
    .map((candidate) => candidate.point)
}

function nearSharedEdge(point, edge, size) {
  if (!point || !edge || size == null) return false
  const d = pointToSegmentDistance(point, { a: edge.a, b: edge.b })
  return d <= size * 0.2
}

function standInDestinationHex(point, toHex, hexAtPoint, size = null) {
  if (!point || !toHex?.id) return false
  if (size != null) return pointInHexPolygon(point, toHex, size)
  return hexAtPoint(point, null) === toHex.id
}

function hexPolygon(hex, size) {
  if (!hex || size == null) return []
  const center = axialToPixel(hex.q, hex.r, size)
  return hexCorners(center.x, center.y, size)
}

function barriersIntersectingHex(ctx, hex, size) {
  const polygon = hexPolygon(hex, size)
  if (polygon.length < 3) return []
  const edges = polygon.map((a, index) => ({
    a,
    b: polygon[(index + 1) % polygon.length],
  }))
  return barrierList(ctx).filter(
    (seg) =>
      pointInHexPolygon(seg.a, hex, size) ||
      pointInHexPolygon(seg.b, hex, size) ||
      edges.some((edge) => segmentIntersection(seg.a, seg.b, edge.a, edge.b)),
  )
}

export function pointInHexPolygon(point, hex, size) {
  if (!point || !hex || size == null) return false
  const corners = hexPolygon(hex, size)
  if (corners.length < 3) return false
  const eps = 1e-6
  let sign = 0
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % corners.length]
    const cross = sideOfLine(point, a, b)
    if (Math.abs(cross) <= eps) continue
    const nextSign = Math.sign(cross)
    if (sign && nextSign !== sign) return false
    sign = nextSign
  }
  return true
}

function segmentInsideHex(a, b, hex, size) {
  for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    if (!pointInHexPolygon(interpolate(a, b, t), hex, size)) return false
  }
  return true
}

function uniquePush(points, point) {
  if (!point) return
  if (points.some((p) => samePoint(p, point))) return
  points.push(point)
}

function barrierJunctions(ctx) {
  const barriers = barrierList(ctx)
  const cached = BARRIER_JUNCTION_CACHE.get(barriers)
  if (cached) return cached
  const junctions = []
  for (let i = 0; i < barriers.length; i++) {
    const seg = barriers[i]
    for (let j = i + 1; j < barriers.length; j++) {
      const other = barriers[j]
      const intersection = segmentIntersection(seg.a, seg.b, other.a, other.b)
      if (intersection) {
        uniquePush(junctions, { x: intersection.x, y: intersection.y })
      }
    }
    for (const endpoint of [seg.a, seg.b]) {
      const connects = barriers.some((other) => {
        if (other === seg) return false
        const clearance =
          (BARRIER_STAND_INSET[seg.kind] ?? BARRIER_STAND_INSET.fence) +
          (BARRIER_STAND_INSET[other.kind] ?? BARRIER_STAND_INSET.fence)
        return pointToSegmentDistance(endpoint, other) <= clearance
      })
      if (connects) uniquePush(junctions, endpoint)
    }
  }
  BARRIER_JUNCTION_CACHE.set(barriers, junctions)
  return junctions
}

function nearBarrierJunctionHit(a, b, ctx) {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const denom = vx * vx + vy * vy || 1
  for (const junction of barrierJunctions(ctx)) {
    const t = Math.max(
      0,
      Math.min(
        1,
        ((junction.x - a.x) * vx + (junction.y - a.y) * vy) / denom,
      ),
    )
    if (t < PATH_ORIGIN_EPS) continue
    const point = { x: a.x + vx * t, y: a.y + vy * t }
    if (pointDistance(point, junction) >= 3) continue
    const connected = barrierList(ctx).filter(
      (seg) => pointToSegmentDistance(junction, seg) < 1,
    )
    const seg = connected[0]
    if (!seg) continue
    return { ...point, t, kind: seg.kind, a: seg.a, b: seg.b }
  }
  return null
}

function segmentClearsBarrierJunctions(a, b, ctx, minClearance) {
  for (const junction of barrierJunctions(ctx)) {
    if (pointToSegmentDistance(junction, { a, b }) < minClearance) {
      return false
    }
  }
  return true
}

/**
 * Barrier-bounded walk inside one hex from `from` to `to` without crossing barriers.
 * Uses a cell-local graph search within the hex polygon (reachable sub-area).
 */
export function pathInHex(hex, from, to, ctx, size) {
  if (!hex || !from || !to || !ctx || size == null) return null
  if (!pointInHexPolygon(from, hex, size) || !pointInHexPolygon(to, hex, size)) {
    return null
  }
  if (segmentInsideHex(from, to, hex, size) && pathClear([from, to], ctx)) {
    return [from, to]
  }

  const corners = hexPolygon(hex, size)
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const step = Math.max(6, size / 4)
  const maxEdge = step * 1.55
  const nodes = []
  uniquePush(nodes, from)
  uniquePush(nodes, to)

  const center = hexCenterStand(hex, size)
  uniquePush(nodes, center)
  for (const corner of corners) {
    uniquePush(nodes, interpolate(corner, center, 0.12))
  }
  for (let x = minX; x <= maxX + 0.01; x += step) {
    for (let y = minY; y <= maxY + 0.01; y += step) {
      const point = { x, y }
      if (pointInHexPolygon(point, hex, size)) uniquePush(nodes, point)
    }
  }

  const startIdx = 0
  const targetIdx = 1
  const queue = [startIdx]
  const prev = new Map([[startIdx, null]])

  while (queue.length) {
    const idx = queue.shift()
    if (idx === targetIdx) break
    const current = nodes[idx]
    for (let nextIdx = 0; nextIdx < nodes.length; nextIdx++) {
      if (prev.has(nextIdx) || nextIdx === idx) continue
      const next = nodes[nextIdx]
      const dist = pointDistance(current, next)
      if (nextIdx !== targetIdx && dist > maxEdge) continue
      if (nextIdx === targetIdx && dist > maxEdge && idx !== startIdx) continue
      if (!segmentInsideHex(current, next, hex, size)) continue
      if (
        !segmentClearsBarrierJunctions(
          current,
          next,
          ctx,
          BARRIER_STAND_INSET.fence * 2.5,
        )
      ) {
        continue
      }
      if (!pathClear([current, next], ctx)) continue
      prev.set(nextIdx, idx)
      queue.push(nextIdx)
    }
  }

  if (!prev.has(targetIdx)) return null
  const path = []
  for (let idx = targetIdx; idx != null; idx = prev.get(idx)) {
    path.unshift(nodes[idx])
  }
  return path
}

/** @deprecated use pathInHex */
function localReachablePath(args) {
  return pathInHex(args.hex, args.from, args.to, args.ctx, args.size)
}

function canReachInHex(hex, from, to, ctx, size) {
  return pathInHex(hex, from, to, ctx, size) != null
}

/**
 * Shared-border samples reachable from `fromPos` inside `fromHex` without
 * crossing a barrier (sub-area walk to the edge, then step inward).
 */
function reachableSharedBorderEntries(fromHex, toHex, fromPos, ctx, size) {
  const edge = sharedHexEdge(fromHex, toHex, size)
  if (!edge) return []
  const travelCtx = interHexTravelCtx(ctx)
  const moveCtx = moveHexContext(fromHex, toHex)
  const entries = []
  for (const sample of sampleSharedEdge(edge, toHex, size)) {
    const approach = pathInHex(fromHex, fromPos, sample.edgePoint, travelCtx, size)
    if (!approach) continue
    if (!pathClear([sample.edgePoint, sample.insidePoint], travelCtx, moveCtx)) {
      continue
    }
    entries.push({
      entryPoint: sample.insidePoint,
      approachPath: [...approach, sample.insidePoint],
    })
  }
  return entries
}

/** Stand near the midpoint of the barrier blocking entry from the shared border. */
function barrierMidpointStand(entryPoint, toHex, ctx, size, hexAtPoint) {
  const travelCtx = interHexTravelCtx(ctx)
  const center = hexCenterStand(toHex, size)
  const hit = firstBlockedOnPath([entryPoint, center], travelCtx)
  if (!hit) return null

  const mid = {
    x: (hit.a.x + hit.b.x) / 2,
    y: (hit.a.y + hit.b.y) / 2,
  }
  const inset = BARRIER_STAND_INSET[hit.kind] ?? BARRIER_STAND_INSET.fence
  const dx = entryPoint.x - mid.x
  const dy = entryPoint.y - mid.y
  const len = Math.hypot(dx, dy) || 1
  const stand = {
    x: mid.x + (dx / len) * inset,
    y: mid.y + (dy / len) * inset,
  }
  if (!standInDestinationHex(stand, toHex, hexAtPoint, size)) return null
  if (pathClear([entryPoint, stand], travelCtx)) return stand
  const path = pathInHex(toHex, entryPoint, stand, travelCtx, size)
  return path ? path[path.length - 1] : null
}

function standReachableFromEntry({
  entryPoint,
  target,
  toHex,
  ctx,
  size,
  hexAtPoint,
  moveCtx,
}) {
  const travelCtx = interHexTravelCtx(ctx)
  if (!target || !standInDestinationHex(target, toHex, hexAtPoint, size)) return null
  if (!hasSafeBarrierClearance(target, barrierList(travelCtx))) return null
  if (pathClear([entryPoint, target], travelCtx, moveCtx)) return target
  const path = pathInHex(toHex, entryPoint, target, travelCtx, size)
  if (path) return path[path.length - 1]
  return null
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
      if (!standInDestinationHex(point, toHex, hexAtPoint, size)) continue
      if (walkPath.length > 2 || !edge || nearSharedEdge(point, edge, size)) {
        return { entryPoint: point, approachPath: walkPath.slice(0, i + 1) }
      }
    }
  }

  const chordTargets = []
  if (
    toPos &&
    standInDestinationHex(toPos, toHex, hexAtPoint, size) &&
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
    for (const border of reachableSharedBorderEntries(
      fromHex,
      toHex,
      fromPos,
      ctx,
      size,
    )) {
      return border
    }
    for (const sample of sampleSharedEdge(edge, toHex, size)) {
      for (let t = 0.1; t < 1; t += 0.1) {
        const p = interpolate(fromPos, sample.insidePoint, t)
        if (!standInDestinationHex(p, toHex, hexAtPoint, size)) continue
        const approachPath = [fromPos, p]
        if (pathClear(approachPath, travelCtx, moveCtx)) {
          return { entryPoint: p, approachPath }
        }
      }
    }
    for (const sample of sampleSharedEdge(edge, toHex, size)) {
      if (!pathClear([sample.edgePoint, sample.insidePoint], travelCtx, moveCtx)) {
        continue
      }
      const localPath = pathInHex(
        fromHex,
        fromPos,
        sample.edgePoint,
        travelCtx,
        size,
      )
      if (localPath) {
        return {
          entryPoint: sample.insidePoint,
          approachPath: [...localPath, sample.insidePoint],
        }
      }
    }
  }
  return null
}

/**
 * Step 2: from a point just inside the destination hex, pick where to stand.
 * A barrier-divided cell is handled before the generic center fallback.
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
  const cellBarriers = barriersIntersectingHex(travelCtx, toHex, size)
  const barrierDividedCell = cellBarriers.length > 0

  if (
    toPos &&
    samePoint(entryPoint, toPos) &&
    hasSafeBarrierClearance(entryPoint, cellBarriers)
  ) {
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

  if (
    routeStand &&
    walkPath.length > 2 &&
    standInDestinationHex(routeStand, toHex, hexAtPoint, size) &&
    hasSafeBarrierClearance(routeStand, cellBarriers) &&
    canReachInHex(toHex, entryPoint, routeStand, travelCtx, size)
  ) {
    return { stand: routeStand, blockedKind: null }
  }

  const authored = toHex?.standAt ? resolveAvatarPosition(toHex, size) : null
  const center = hexCenterStand(toHex, size)
  const midpoint = barrierMidpointStand(
    entryPoint,
    toHex,
    ctx,
    size,
    hexAtPoint,
  )
  const neighborTarget =
    toPos && !samePoint(toPos, authored) ? toPos : null
  const preferred = barrierDividedCell
    ? [authored, neighborTarget]
    : [authored, neighborTarget, center]

  for (const target of preferred.filter(Boolean)) {
    const stand = standReachableFromEntry({
      entryPoint,
      target,
      toHex,
      ctx,
      size,
      hexAtPoint,
      moveCtx,
    })
    if (stand) return { stand, blockedKind: null }
  }

  const interiorCandidates = hexInteriorCandidates(
    fromHex,
    toHex,
    entryPoint,
    hexAtPoint,
    size,
    travelCtx,
  )

  if (barrierDividedCell) {
    for (const pt of interiorCandidates) {
      const stand = standReachableFromEntry({
        entryPoint,
        target: pt,
        toHex,
        ctx,
        size,
        hexAtPoint,
        moveCtx,
      })
      if (stand) return { stand, blockedKind: null }
    }

    if (midpoint && hasSafeBarrierClearance(midpoint, cellBarriers)) {
      return { stand: midpoint, blockedKind: null }
    }

    const centerStand = standReachableFromEntry({
      entryPoint,
      target: center,
      toHex,
      ctx,
      size,
      hexAtPoint,
      moveCtx,
    })
    if (centerStand) return { stand: centerStand, blockedKind: null }
  }

  for (const pt of interiorCandidates) {
    if (preferred.some((p) => p && samePoint(p, pt))) continue
    const stand = standReachableFromEntry({
      entryPoint,
      target: pt,
      toHex,
      ctx,
      size,
      hexAtPoint,
      moveCtx,
    })
    if (stand) return { stand, blockedKind: null }
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
    const junctionHit = nearBarrierJunctionHit(a, b, travelCtx)
    if (junctionHit) return { ...junctionHit, segIndex: i }
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
    const junctionHit = nearBarrierJunctionHit(a, b, travelCtx)
    if (
      junctionHit &&
      hexAtPoint({ x: junctionHit.x, y: junctionHit.y }, hexId) === hexId
    ) {
      return { ...junctionHit, segIndex: i }
    }
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
