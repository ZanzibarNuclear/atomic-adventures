/**
 * Fence and river barriers for off-road travel.
 * Crossing is allowed only at authored openings (gate/hole, bridge/ford).
 */

import { axialToPixel } from './useHexGeometry.js'

const STAND_INSET = 5

const OPENING_RADIUS = {
  gate: 22,
  hole: 14,
  bridge: 14,
  ford: 12,
}

const FENCE_OPENINGS = new Set(['gate', 'hole'])
const RIVER_OPENINGS = new Set(['bridge', 'ford'])

/** Point features — not drawable / routable polylines. */
export const BARRIER_OPENING_KINDS = new Set([
  'gate',
  'hole',
  'bridge',
  'ford',
])

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

export function fenceSegments(featureModels) {
  const segs = []
  for (const m of featureModels) {
    if (m.kind !== 'fence') continue
    for (let i = 0; i < m.points.length - 1; i++) {
      segs.push({ a: m.points[i], b: m.points[i + 1], kind: 'fence' })
    }
  }
  return segs
}

export function riverSegments(featureModels) {
  const segs = []
  for (const m of featureModels) {
    if (m.kind !== 'river') continue
    for (let i = 0; i < m.points.length - 1; i++) {
      segs.push({ a: m.points[i], b: m.points[i + 1], kind: 'river' })
    }
  }
  return segs
}

/** Passable points for fence (gate/hole) and river (bridge/ford) crossings. */
export function travelOpenings(mapFeatures) {
  return (mapFeatures ?? [])
    .filter((f) => f.at && ['gate', 'hole', 'bridge', 'ford'].includes(f.kind))
    .map((f) => ({
      kind: f.kind,
      x: f.at.x,
      y: f.at.y,
      r: f.radius ?? OPENING_RADIUS[f.kind] ?? 12,
    }))
}

export function openingAllows(kind, x, y, openings) {
  const allowed = kind === 'fence' ? FENCE_OPENINGS : RIVER_OPENINGS
  return openings.some(
    (o) =>
      allowed.has(o.kind) && Math.hypot(x - o.x, y - o.y) <= o.r,
  )
}

/** Distance from point P to segment AB. */
function pointSegmentDistance(p, a, b) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lenSq = abx * abx + aby * aby
  if (lenSq < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby))
}

/** Does any point along the path pass within an opening allowing `kind`? */
function pathNearOpening(path, kind, openings) {
  const allowed = kind === 'fence' ? FENCE_OPENINGS : RIVER_OPENINGS
  return openings.some((o) => {
    if (!allowed.has(o.kind)) return false
    for (let i = 0; i < path.length - 1; i++) {
      if (pointSegmentDistance(o, path[i], path[i + 1]) <= o.r) return true
    }
    return false
  })
}

/** Entering a different enclosure requires passing through a fence opening. */
function entersEnclosureWithoutOpening(fromHex, toHex, path, openings) {
  const enclosure = toHex?.enclosure
  if (!enclosure || fromHex?.enclosure === enclosure) return false
  return !pathNearOpening(path, 'fence', openings)
}

/** Both tiles are inside the same authored compound (e.g. utility yard). */
function sharesEnclosure(fromHex, toHex) {
  return !!(
    fromHex?.enclosure &&
    fromHex.enclosure === toHex?.enclosure
  )
}

/** Fence polylines trace the compound outline and cross many internal hex edges. */
function skipFenceForMove(fromHex, toHex, seg) {
  return seg.kind === 'fence' && sharesEnclosure(fromHex, toHex)
}

/**
 * The shared edge between two adjacent hexes — the geometric boundary where
 * barriers should actually be checked, as opposed to the center-to-center
 * segment which passes through each hex's interior.
 *
 * Rivers and fences often have waypoints anchored inside hexes. Checking the
 * center-to-center path can cross a segment that runs through the target hex's
 * interior even though the barrier never touches the shared boundary, producing
 * false blocks. Checking the shared edge fixes this.
 */
function sharedHexEdge(centerA, centerB, size) {
  const mx = (centerA.x + centerB.x) / 2
  const my = (centerA.y + centerB.y) / 2
  const dist = Math.hypot(centerB.x - centerA.x, centerB.y - centerA.y)
  // Perpendicular direction (left-hand normal of A→B).
  const px = -(centerB.y - centerA.y) / dist
  const py = (centerB.x - centerA.x) / dist
  // For a regular hex with circumradius = size, the side length also equals
  // size, so the shared edge extends size/2 on each side of the midpoint.
  const half = size / 2
  return {
    a: { x: mx + px * half, y: my + py * half },
    b: { x: mx - px * half, y: my - py * half },
  }
}

/**
 * Deterministic passability of the edge between two adjacent hexes.
 * Returns null when passable, else the blocking barrier kind.
 *
 * Checks the shared hex edge (the physical boundary between the two tiles)
 * rather than the center-to-center segment. This correctly handles barriers
 * whose waypoints lie inside a hex's interior — a river that flows through a
 * hex does not block entry from a direction where it never crosses the border.
 * The enclosure rule still uses the shared edge to test proximity to openings.
 */
export function edgeBlock(fromHex, toHex, size, ctx) {
  const a = axialToPixel(fromHex.q, fromHex.r, size)
  const b = axialToPixel(toHex.q, toHex.r, size)
  const edge = sharedHexEdge(a, b, size)

  for (const seg of [...ctx.fences, ...ctx.rivers]) {
    if (skipFenceForMove(fromHex, toHex, seg)) continue
    const cross = segmentIntersection(edge.a, edge.b, seg.a, seg.b)
    if (!cross) continue
    if (!openingAllows(seg.kind, cross.x, cross.y, ctx.openings)) {
      return seg.kind
    }
  }

  if (entersEnclosureWithoutOpening(fromHex, toHex, [edge.a, edge.b], ctx.openings)) {
    return 'fence'
  }

  return null
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

function pathBarrierCrossings(path, ctx) {
  const hits = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (const seg of [...ctx.fences, ...ctx.rivers]) {
      const cross = segmentIntersection(a, b, seg.a, seg.b)
      if (!cross || cross.t < 0.02) continue
      hits.push({ x: cross.x, y: cross.y, kind: seg.kind })
    }
  }
  return hits
}

function pathCrossesBlockedBarrier(path, ctx) {
  return pathBarrierCrossings(path, ctx).some(
    (hit) => !openingAllows(hit.kind, hit.x, hit.y, ctx.openings),
  )
}

/**
 * Whether a marked-route move should be hidden / rejected.
 * Checks the actual path geometry plus the enclosure rule (a route may
 * legitimately cross via an opening the hex centers' line misses).
 */
export function isRouteMoveBlocked(fromHex, toHex, pathSamples, ctx) {
  if (pathSamples.length < 2) return false

  if (pathCrossesBlockedBarrier(pathSamples, ctx)) return true

  return entersEnclosureWithoutOpening(
    fromHex,
    toHex,
    pathSamples,
    ctx.openings,
  )
}

function standBeforeHit(from, hit) {
  const dx = from.x - hit.x
  const dy = from.y - hit.y
  const len = Math.hypot(dx, dy)
  if (len < 1) {
    return { x: hit.x, y: hit.y, barrierKind: hit.kind }
  }
  return {
    x: hit.x + (dx / len) * STAND_INSET,
    y: hit.y + (dy / len) * STAND_INSET,
    barrierKind: hit.kind,
  }
}

function firstBlockedCrossOnSegment(from, to, ctx, fromHex, toHex) {
  let hit = null
  for (const seg of [...ctx.fences, ...ctx.rivers]) {
    if (fromHex && toHex && skipFenceForMove(fromHex, toHex, seg)) continue
    const cross = segmentIntersection(from, to, seg.a, seg.b)
    if (!cross || cross.t < 0.02) continue
    if (openingAllows(seg.kind, cross.x, cross.y, ctx.openings)) continue
    if (!hit || cross.t < hit.t) hit = { ...cross, kind: seg.kind }
  }
  return hit
}

/**
 * Visual stand point for a blocked move attempt: where the avatar stops when
 * walking from `from` toward `to`, on the approach side of the barrier that
 * actually blocks the move (matched to edgeBlock when hexes are provided).
 */
export function findBarrierStand(from, to, ctx, fromHex, toHex, size) {
  if (fromHex && toHex && size != null) {
    const block = edgeBlock(fromHex, toHex, size, ctx)
    if (!block) return null

    const a = axialToPixel(fromHex.q, fromHex.r, size)
    const b = axialToPixel(toHex.q, toHex.r, size)
    const edge = sharedHexEdge(a, b, size)

    for (const seg of [...ctx.fences, ...ctx.rivers]) {
      if (skipFenceForMove(fromHex, toHex, seg)) continue
      if (seg.kind !== block) continue
      const cross = segmentIntersection(edge.a, edge.b, seg.a, seg.b)
      if (!cross) continue
      if (openingAllows(seg.kind, cross.x, cross.y, ctx.openings)) continue
      return standBeforeHit(from, { ...cross, kind: seg.kind })
    }
  }

  const hit = firstBlockedCrossOnSegment(from, to, ctx, fromHex, toHex)
  return hit ? standBeforeHit(from, hit) : null
}
