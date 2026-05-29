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
export function hexCornerPoints(cx, cy, size) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    // Pointy-top: first corner at 30deg (top point straight up).
    const angle = (Math.PI / 180) * (60 * i - 30)
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`)
  }
  return pts.join(' ')
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
