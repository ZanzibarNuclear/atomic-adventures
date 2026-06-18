// Axial/cube hex math for a pointy-top layout.
// Reference: https://www.redblobgames.com/grids/hexagons/

const SQRT3 = Math.sqrt(3)

// Pointy-top neighbor directions in axial (q, r) space.
export const NEIGHBOR_DIRS = [
  { q: 1, r: 0 }, // E
  { q: 1, r: -1 }, // NE
  { q: 0, r: -1 }, // NW
  { q: -1, r: 0 }, // W
  { q: -1, r: 1 }, // SW
  { q: 0, r: 1 }, // SE
]

// Center pixel of a hex, given its size (corner-to-center radius).
export function axialToPixel(q, r, size) {
  return {
    x: size * SQRT3 * (q + r / 2),
    y: size * (3 / 2) * r,
  }
}

// The six corner points of a pointy-top hex, as an SVG "points" string.
export function hexCorners(cx, cy, size) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    // Pointy-top: first corner at 30deg (top point straight up).
    const angle = (Math.PI / 180) * (60 * i - 30)
    pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) })
  }
  return pts
}

// The six corner points of a pointy-top hex, as an SVG "points" string.
export function hexCornerPoints(cx, cy, size) {
  const pts = hexCorners(cx, cy, size)
  return pts.map((p) => `${p.x},${p.y}`).join(' ')
}

// Pixel -> axial (pointy-top), rounded to the containing hex.
// This is what lets a path's geometry decide which hex "lights up",
// independent of how the path is aligned to the grid.
export function pixelToHex(x, y, size) {
  const qf = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size
  const rf = ((2 / 3) * y) / size
  return cubeRound(qf, rf)
}

function cubeRound(qf, rf) {
  let rx = Math.round(qf)
  let rz = Math.round(rf)
  let ry = Math.round(-qf - rf)
  const dx = Math.abs(rx - qf)
  const dz = Math.abs(rz - rf)
  const dy = Math.abs(ry - (-qf - rf))
  if (dx > dy && dx > dz) rx = -ry - rz
  else if (dy > dz) ry = -rx - rz
  else rz = -rx - ry
  return { q: rx, r: rz }
}

// Axial -> cube, for distance.
function axialToCube(q, r) {
  return { x: q, z: r, y: -q - r }
}

export function hexDistance(a, b) {
  const ac = axialToCube(a.q, a.r)
  const bc = axialToCube(b.q, b.r)
  return (Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y) + Math.abs(ac.z - bc.z)) / 2
}

export function neighborsOf(hex) {
  return NEIGHBOR_DIRS.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }))
}

/** Fixed gameplay viewport size from a canonical 7-hex cluster at the origin. */
export function gameplayViewDimensions(size) {
  const cluster = [{ q: 0, r: 0 }, ...neighborsOf({ q: 0, r: 0 })]
  return boundsOf(cluster, size)
}

/** Gameplay viewBox: fixed zoom, current hex at center. */
export function fixedGameplayViewBox(centerHex, size) {
  const dims = gameplayViewDimensions(size)
  const center = axialToPixel(centerHex.q, centerHex.r, size)
  return {
    x: center.x - dims.width / 2,
    y: center.y - dims.height / 2,
    width: dims.width,
    height: dims.height,
  }
}

/** Whether a hex's footprint intersects a viewBox rectangle. */
export function hexIntersectsViewBox(hex, viewBox, size) {
  if (!hex || !viewBox) return false
  const { x: cx, y: cy } = axialToPixel(hex.q, hex.r, size)
  const pad = size
  const hexMinX = cx - pad
  const hexMaxX = cx + pad
  const hexMinY = cy - pad
  const hexMaxY = cy + pad
  const boxMaxX = viewBox.x + viewBox.width
  const boxMaxY = viewBox.y + viewBox.height
  return !(
    hexMaxX < viewBox.x ||
    hexMinX > boxMaxX ||
    hexMaxY < viewBox.y ||
    hexMinY > boxMaxY
  )
}

// Bounding box (in pixel space) of a list of hexes, padded by one hex.
export function boundsOf(hexes, size) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const h of hexes) {
    const { x, y } = axialToPixel(h.q, h.r, size)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const pad = size * 1.4
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}
