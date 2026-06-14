/**
 * Place the avatar on the eastern bank of the river within a hex.
 * Screen-x increases east; the river runs through the western side of these tiles.
 */

import { axialToPixel } from './useHexGeometry.js'

const BANK_INSET = 8

/** River x at horizontal line y (interpolates along segments). */
export function riverXAtY(riverSegments, y) {
  let best = null
  for (const seg of riverSegments) {
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

/** True when the river passes through this hex at the given y. */
export function hexHasRiverAtY(hex, y, size, riverSegments) {
  if (!hex || !riverSegments?.length) return false
  const c = axialToPixel(hex.q, hex.r, size)
  const half = size * 0.9
  const rx = riverXAtY(riverSegments, y)
  if (rx == null) return false
  return (
    Math.abs(y - c.y) <= half &&
    rx >= c.x - half &&
    rx <= c.x + half
  )
}

/** Stand on the eastern bank at the given y (defaults to hex center y). */
export function bankStandAt(hex, size, riverSegments, y) {
  const c = axialToPixel(hex.q, hex.r, size)
  const standY = y ?? c.y
  const riverX = riverXAtY(riverSegments, standY)
  if (riverX == null) return null
  return { x: riverX + BANK_INSET, y: standY }
}

/** Whether this hex should use bank positioning (river crosses near center y). */
export function hexOnRiverBank(hex, size, riverSegments) {
  const c = axialToPixel(hex.q, hex.r, size)
  return hexHasRiverAtY(hex, c.y, size, riverSegments)
}
