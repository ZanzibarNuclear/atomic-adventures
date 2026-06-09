/**
 * Fence and river barriers for off-road travel.
 * Crossing is allowed only at authored openings (gate/hole, bridge/ford).
 */

import { axialToPixel } from './useHexGeometry.js'

const STAND_INSET = 5
/** x of the compound's east fence; approach points sit east of this. */
const COMPOUND_OUTSIDE_X = -22

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
 * Checks the actual path geometry plus enclosure access rules.
 */
export function isRouteMoveBlocked(
  fromHex,
  toHex,
  pathSamples,
  size,
  ctx,
  enclosureAccess,
) {
  if (pathSamples.length < 2) return false

  if (pathCrossesBlockedBarrier(pathSamples, ctx)) return true

  const enclosure = toHex.enclosure
  if (!enclosure || enclosureAccess.has(enclosure)) return false

  const fenceHits = pathBarrierCrossings(pathSamples, ctx).filter(
    (h) => h.kind === 'fence',
  )
  if (
    fenceHits.length > 0 &&
    fenceHits.every((h) => openingAllows('fence', h.x, h.y, ctx.openings))
  ) {
    return false
  }

  const fromPos = pathSamples[0]
  return !!resolveOffRoadBarrier(
    fromHex,
    toHex,
    fromPos,
    size,
    ctx,
    enclosureAccess,
  )
}

/**
 * If an off-road walk from `from` toward `to` hits a barrier without a nearby
 * opening, return where the avatar should stand (just inside the destination side).
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

/**
 * Off-road barrier check including enclosed compounds.
 *
 * A line from avatar → destination can miss the fence when both hex centres
 * sit inside the same enclosure. Until route access is granted, treat any
 * off-road move into an enclosed hex as crossing from outside.
 */
export function resolveOffRoadBarrier(
  fromHex,
  toHex,
  fromPos,
  size,
  ctx,
  enclosureAccess,
) {
  const toCenter = axialToPixel(toHex.q, toHex.r, size)
  const fromCenter = axialToPixel(fromHex.q, fromHex.r, size)

  let hit = findBarrierStand(fromPos, toCenter, ctx)
  if (hit) return hit

  const enclosure = toHex.enclosure
  if (!enclosure || enclosureAccess.has(enclosure)) return null

  // Virtual approach from east of the compound fence.
  const outside = {
    x: Math.max(COMPOUND_OUTSIDE_X, fromPos.x, fromCenter.x),
    y: fromPos.y,
  }
  hit = findBarrierStand(outside, toCenter, ctx)
  if (hit) return hit

  if (fromHex.enclosure === enclosure) {
    hit = findBarrierStand(
      { x: COMPOUND_OUTSIDE_X, y: fromPos.y },
      toCenter,
      ctx,
    )
    if (hit) return hit
  }

  return null
}
