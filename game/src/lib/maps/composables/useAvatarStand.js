import { axialToPixel } from './useHexGeometry.js'

/** Default offset from a landmark icon when standAt is omitted (hex-size units). */
export const DEFAULT_BESIDE_LANDMARK = { dx: 0.34, dy: 0.42 }

/** Hex carries a visible landmark (emoji icon or authored building graphic). */
export function hasLandmarkMarker(hex) {
  const lm = hex?.landmark
  return !!(lm?.icon || lm?.building)
}

/** Pixel position of the landmark icon anchor (hex center + landmark dx/dy). */
export function landmarkAnchor(hex, size) {
  const c = axialToPixel(hex.q, hex.r, size)
  const lm = hex.landmark ?? {}
  return {
    x: c.x + size * (lm.dx ?? 0),
    y: c.y + size * (lm.dy ?? 0),
  }
}

/**
 * Where the player stands on a hex (YAML / landmark / center).
 *
 * standAt forms (see map.yaml header):
 *   { x, y }                    — fixed world coords (e.g. gate approach)
 *   { from: landmark, dx, dy }  — beside the building; moves when landmark moves
 *   { dx, dy }                  — offset from hex center (e.g. river bank)
 */
export function resolveAvatarPosition(hex, size) {
  if (!hex) return { x: 0, y: 0 }
  const c = axialToPixel(hex.q, hex.r, size)
  const stand = hex.standAt

  if (stand) {
    if (stand.from !== 'landmark' && stand.x != null && stand.y != null) {
      return { x: stand.x, y: stand.y }
    }
    const anchor = stand.from === 'landmark' ? landmarkAnchor(hex, size) : c
    return {
      x: anchor.x + size * (stand.dx ?? 0),
      y: anchor.y + size * (stand.dy ?? 0),
    }
  }

  if (hasLandmarkMarker(hex)) {
    const base = landmarkAnchor(hex, size)
    return {
      x: base.x + size * DEFAULT_BESIDE_LANDMARK.dx,
      y: base.y + size * DEFAULT_BESIDE_LANDMARK.dy,
    }
  }

  return c
}

/** Hex center — default destination for adjacent hex moves. */
export function hexCenterStand(hex, size) {
  return axialToPixel(hex.q, hex.r, size)
}

/** Preferred stand when stepping to an adjacent hex: authored `standAt`, else center. */
export function resolveNeighborStand(fromHex, toHex, fromPos, size, barrierCtx) {
  const stand = toHex?.standAt
  if (stand) {
    return resolveAvatarPosition(toHex, size)
  }
  return hexCenterStand(toHex, size)
}
