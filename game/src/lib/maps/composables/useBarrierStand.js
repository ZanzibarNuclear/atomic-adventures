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
