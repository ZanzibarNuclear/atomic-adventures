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

/**
 * Deterministic passability of the edge between two adjacent hexes.
 * Returns null when passable, else the blocking barrier kind.
 *
 * Independent of avatar position: uses the center-to-center segment plus the
 * enclosure rule (the enclosure boundary acts as an implicit fence even where
 * the authored polyline doesn't separate the two centers).
 */
export function edgeBlock(fromHex, toHex, size, ctx) {
  const a = axialToPixel(fromHex.q, fromHex.r, size)
  const b = axialToPixel(toHex.q, toHex.r, size)

  for (const seg of [...ctx.fences, ...ctx.rivers]) {
    const cross = segmentIntersection(a, b, seg.a, seg.b)
    if (!cross) continue
    if (!openingAllows(seg.kind, cross.x, cross.y, ctx.openings)) {
      return seg.kind
    }
  }

  if (entersEnclosureWithoutOpening(fromHex, toHex, [a, b], ctx.openings)) {
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

/**
 * Visual stand point for a blocked move attempt: where the avatar stops when
 * walking from `from` toward `to`, on the approach side of the first
 * uncrossable barrier. Returns null when the straight walk hits nothing
 * (e.g. a move blocked only by the enclosure rule).
 */
export function findBarrierStand(from, to, { fences, rivers, openings }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return null
  const dir = { x: dx / len, y: dy / len }

  let hit = null
  for (const seg of [...fences, ...rivers]) {
    const cross = segmentIntersection(from, to, seg.a, seg.b)
    if (!cross || cross.t < 0.02) continue
    if (openingAllows(seg.kind, cross.x, cross.y, openings)) continue
    if (!hit || cross.t < hit.t) hit = { ...cross, kind: seg.kind }
  }

  if (!hit) return null

  // Stop on the approach side of the barrier — never past the line.
  return {
    x: hit.x - dir.x * STAND_INSET,
    y: hit.y - dir.y * STAND_INSET,
    barrierKind: hit.kind,
  }
}
