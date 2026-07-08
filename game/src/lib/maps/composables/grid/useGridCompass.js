/** Layout axes: +x = north, +y = east. Room rect edges in layout space. */
const COMPASS_TO_LAYOUT_SIDE = {
  north: 'right',
  south: 'left',
  east: 'bottom',
  west: 'top',
}

export const COMPASS_EDGES = ['north', 'south', 'east', 'west']

/** Normalize an edge name to a compass direction. */
export function normalizeCompassEdge(edge, fallback = 'west') {
  if (!edge) return fallback
  const key = String(edge).toLowerCase()
  if (COMPASS_TO_LAYOUT_SIDE[key]) return key
  return fallback
}

/** Map compass edge to layout rect side: top | bottom | left | right. */
export function layoutSideFromEdge(edge, fallback = 'top') {
  const compass = normalizeCompassEdge(edge, null)
  if (compass) return COMPASS_TO_LAYOUT_SIDE[compass]
  return fallback
}

/** Degrees added to user rotation so layout north appears per building.north. */
const NORTH_ORIENTATION_BASE = {
  up: 270,
  right: 0,
  down: 90,
  left: 180,
}

export function northOrientationBase(north = 'up') {
  return NORTH_ORIENTATION_BASE[north] ?? 270
}
