import { boundsOf } from '../src/composables/useHexGeometry.js'
import { sliceRingHexes } from '../src/composables/useHexMapViewport.js'

// Minimal fixture matching trailhead / east-pines from content/world/map.yaml.
const size = 44
const hexes = [
  { id: 'east-pines', q: 1, r: 0, terrain: 'forest' },
  { id: 'trailhead', q: 2, r: 0, terrain: 'forest' },
]
const hexById = Object.fromEntries(hexes.map((h) => [h.id, h]))

function sliceViewport(currentHexId, discovered) {
  const revealed = new Set(discovered)
  const standingOn = currentHexId
  const current = hexById[currentHexId]
  const isVisible = (hex) => revealed.has(hex.id) || hex.id === standingOn

  const { ringIds, ringHexes } = sliceRingHexes(hexes, current, currentHexId)
  const visibleHexes = ringHexes.filter(isVisible)
  const fogHexes = ringHexes.filter(
    (h) => !revealed.has(h.id) && h.id !== standingOn,
  )
  const forBounds = [...visibleHexes, ...fogHexes]
  const b = boundsOf(forBounds, size)

  return { ringIds, visibleHexes, fogHexes, bounds: b }
}

let failed = 0

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    failed++
  } else {
    console.log(`ok: ${msg}`)
  }
}

// Game start: trailhead only discovered; east-pines is the on-map neighbor.
const start = sliceViewport('trailhead', ['trailhead'])

assert(
  start.visibleHexes.length === 1 && start.visibleHexes[0].id === 'trailhead',
  'trailhead alone is terrain when only start is discovered',
)
assert(
  start.fogHexes.some((h) => h.id === 'east-pines'),
  'east-pines appears as fog neighbor at trailhead in slice',
)
assert(
  start.ringIds.has('east-pines'),
  'slice ring includes east-pines',
)
assert(
  start.bounds.width > size * 2,
  'viewBox spans more than one hex at trailhead',
)

// After visiting east-pines: both show as terrain, no fog in ring.
const visited = sliceViewport('east-pines', ['trailhead', 'east-pines'])
assert(
  visited.visibleHexes.some((h) => h.id === 'trailhead') &&
    visited.visibleHexes.some((h) => h.id === 'east-pines'),
  'discovered ring neighbors render as terrain',
)
assert(
  !visited.fogHexes.some((h) =>
    ['trailhead', 'east-pines'].includes(h.id),
  ),
  'visited ring hexes are not fog',
)

if (failed) {
  process.exit(1)
}
console.log('All slice viewport checks passed.')
