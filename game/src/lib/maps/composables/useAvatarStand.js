import { axialToPixel } from './useHexGeometry.js'

/** Default offset from a landmark icon when no authored stand is present (hex-size units). */
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

export function normalizeStandEntries(hex) {
  return Array.isArray(hex?.stands)
    ? hex.stands
        .filter((stand) => stand && typeof stand === 'object' && stand.at)
        .map((stand, index) => ({
          id: stand.id ?? `stand-${index + 1}`,
          label: stand.label ?? stand.id ?? `Stand ${index + 1}`,
          at: stand.at,
          source: 'stands',
          index,
        }))
    : []
}

export function resolveStandPoint(hex, at, size) {
  if (!hex || !at) return null
  const c = axialToPixel(hex.q, hex.r, size)
  if (at.from !== 'landmark' && at.x != null && at.y != null) {
    return { x: at.x, y: at.y }
  }
  const anchor = at.from === 'landmark' ? landmarkAnchor(hex, size) : c
  return {
    x: anchor.x + size * (at.dx ?? 0),
    y: anchor.y + size * (at.dy ?? 0),
  }
}

export function authoredStandPositions(hex, size) {
  return normalizeStandEntries(hex)
    .map((stand) => resolveStandPoint(hex, stand.at, size))
    .filter(Boolean)
}

/**
 * Where the player stands on a hex (YAML / landmark / center).
 *
 * stand `at` forms:
 *   { x, y }                    — fixed world coords (e.g. gate approach)
 *   { from: landmark, dx, dy }  — beside the building; moves when landmark moves
 *   { dx, dy }                  — offset from hex center (e.g. river bank)
 */
export function resolveAvatarPosition(hex, size) {
  if (!hex) return { x: 0, y: 0 }
  const c = axialToPixel(hex.q, hex.r, size)
  const authored = authoredStandPositions(hex, size)
  if (authored.length) return authored[0]

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

/**
 * Preferred stand when stepping to an adjacent hex: first authored stand, else center.
 * For barrier-aware arrival (accessible side of in-hex barriers), use
 * `resolveMove` from useTravelBarriers.js.
 */
export function resolveNeighborStand(fromHex, toHex, fromPos, size, barrierCtx) {
  if (normalizeStandEntries(toHex).length) return resolveAvatarPosition(toHex, size)
  return hexCenterStand(toHex, size)
}
