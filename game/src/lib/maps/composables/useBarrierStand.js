/**
 * Stand positions beside barriers — shared by fence stops, river banks, cliffs, ravines.
 */

/** Default pixel inset from a barrier line per kind. */
export const BARRIER_STAND_INSET = {
  fence: 5,
  river: 8,
  cliff: 5,
  ravine: 5,
}

/** Max distance from a barrier line to count as "at" a river bank (status / crossings). */
export const RIVER_BANK_MAX_DIST = BARRIER_STAND_INSET.river * 3

/** Max distance from a fence segment to count as "at" the fence line. */
export const FENCE_LINE_MAX_DIST = BARRIER_STAND_INSET.fence * 4

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Shortest distance from a point to any segment of `kind`. */
export function distToBarrierKind(pos, kind, barriers) {
  let min = Infinity
  for (const seg of barriers ?? []) {
    if (seg.kind !== kind) continue
    const d = distToSegment(pos.x, pos.y, seg.a.x, seg.a.y, seg.b.x, seg.b.y)
    if (d < min) min = d
  }
  return min === Infinity ? null : min
}

export function isNearBarrierKind(pos, kind, barriers, maxDist) {
  const d = distToBarrierKind(pos, kind, barriers)
  if (d == null) return false
  const limit =
    maxDist ??
    (kind === 'river' ? RIVER_BANK_MAX_DIST : FENCE_LINE_MAX_DIST)
  return d <= limit
}

function nearFenceSegment(pos, seg, maxDist) {
  const d = distToSegment(pos.x, pos.y, seg.a.x, seg.a.y, seg.b.x, seg.b.y)
  if (d > maxDist) return false
  const dx = Math.abs(seg.b.x - seg.a.x)
  const dy = Math.abs(seg.b.y - seg.a.y)
  // Horizontal fence runs (north boundary): interior is south (larger y).
  if (dx > dy) {
    const segY = (seg.a.y + seg.b.y) / 2
    return pos.y > segY - 1
  }
  return true
}

/**
 * Which barrier kind the avatar is standing beside, if any — for status hints
 * and atBarrier state. Picks the nearest barrier within kind-specific range.
 */
export function barrierHintAtStand(stand, barriers) {
  let best = null
  for (const kind of ['fence', 'river']) {
    const maxDist = kind === 'river' ? RIVER_BANK_MAX_DIST : FENCE_LINE_MAX_DIST
    let d = null
    for (const seg of barriers ?? []) {
      if (seg.kind !== kind) continue
      const segDist = distToSegment(stand.x, stand.y, seg.a.x, seg.a.y, seg.b.x, seg.b.y)
      if (segDist > maxDist) continue
      if (kind === 'fence' && !nearFenceSegment(stand, seg, maxDist)) continue
      if (d == null || segDist < d) d = segDist
    }
    if (d != null && (!best || d < best.dist)) {
      best = { kind, dist: d }
    }
  }
  return best?.kind ?? null
}

/**
 * Stand just before a path–barrier intersection, inset along the approach vector.
 * Used when a walk hits a fence/cliff/ravine segment without a nearby opening.
 */
export function standBeforeBarrierHit(from, hit, { inset = BARRIER_STAND_INSET.fence } = {}) {
  const dx = from.x - hit.x
  const dy = from.y - hit.y
  const len = Math.hypot(dx, dy)
  if (len < 1) {
    return { x: hit.x, y: hit.y }
  }
  return {
    x: hit.x + (dx / len) * inset,
    y: hit.y + (dy / len) * inset,
  }
}

/**
 * Stand on one side of a barrier polyline at a given y.
 * @param {'east' | 'west'} side — screen-x increases east
 */
export function standBesideBarrierLine({ xAtY, side, y, inset = BARRIER_STAND_INSET.river }) {
  if (xAtY == null) return null
  const offset = side === 'west' ? -inset : inset
  return { x: xAtY + offset, y }
}

/** Barrier x at horizontal line y (interpolates along segments). */
export function barrierXAtY(segments, y) {
  let best = null
  for (const seg of segments) {
    const { a, b } = seg
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    if (y < minY - 0.5 || y > maxY + 0.5) continue
    const dy = b.y - a.y
    let x
    if (Math.abs(dy) < 1e-6) {
      x = (a.x + b.x) / 2
    } else {
      const t = (y - a.y) / dy
      if (t < -0.01 || t > 1.01) continue
      x = a.x + t * (b.x - a.x)
    }
    if (best == null || x > best) best = x
  }
  return best
}
