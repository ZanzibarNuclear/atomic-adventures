/**
 * River barrier regression tests. Run: npx vite-node scripts/test-river-block.mjs
 */
import mapData from '../content/world/map.yaml'
import { buildRouteModels } from '../src/composables/useRoutes.js'
import { axialToPixel, pixelToHex } from '../src/composables/useHexGeometry.js'
import {
  barrierSegments,
  travelOpenings,
  resolveMove,
} from '../src/composables/useTravelBarriers.js'
import { resolveAvatarPosition } from '../src/composables/useAvatarStand.js'

const size = 44
const hexById = Object.fromEntries(mapData.hexes.map((h) => [h.id, h]))
const coordMap = new Map(mapData.hexes.map((h) => [`${h.q},${h.r}`, h.id]))
const featureModels = buildRouteModels(
  mapData.features.filter((f) => !['gate', 'hole', 'bridge', 'ford'].includes(f.kind)),
  hexById,
  mapData.hexes,
  size,
)
const rivers = barrierSegments(featureModels).filter((s) => s.kind === 'river')
const ctx = {
  barriers: barrierSegments(featureModels),
  openings: travelOpenings(mapData.features),
}

function hexAtPoint(pt, fallbackHexId) {
  const { q, r } = pixelToHex(pt.x, pt.y, size)
  return coordMap.get(`${q},${r}`) ?? fallbackHexId
}

function resolve(fromId, toId, fromPosOverride, toPosOverride) {
  const from = hexById[fromId]
  const to = hexById[toId]
  const fromPos =
    fromPosOverride ??
    resolveAvatarPosition(from, size, rivers)
  const toPos =
    toPosOverride ??
    resolveAvatarPosition(to, size, rivers)
  return resolveMove({
    fromHex: from,
    toHex: to,
    fromPos,
    toPos,
    path: [fromPos, toPos],
    ctx,
    hexAtPoint,
    size,
  })
}

/** @type {[string, string, string|null, string|null, object?, object?][]} */
const CASES = [
  // Along eastern bank (same q column) — must pass
  ['utility-yard', 'mid-west', null, 'mid-west'],
  ['mid-west', 'north-west', null, 'north-west'],
  ['mid-west', 'utility-yard', null, 'utility-yard'],
  // Enter river hex from non-river hex — stop at near bank
  ['gate-woods', 'north-west', 'river', 'north-west'],
  ['gate-woods', 'mid-west', 'river', 'mid-west'],
  ['west-slope', 'mid-west', 'river', 'mid-west'],
  ['road-fork', 'upper-gorge', 'river', 'upper-gorge'],
  // No river between — must pass
  ['north-bend', 'gate-woods', null, 'gate-woods'],
  // Fence at compound boundary
  ['west-slope', 'center-pines', 'fence', 'west-slope'],
  ['center-pines', 'west-slope', 'fence', 'center-pines'],
  // Enter compound from outside — avatar at fence, destination hex becomes active
  ['lower-stand', 'south-pines', 'fence', 'south-pines'],
  ['center-pines', 'south-pines', 'fence', 'south-pines'],
  // River block via hex-center path — active hex is destination (near bank)
  ['gate-woods', 'north-west', 'river', 'north-west', axialToPixel(-1, -1, size), axialToPixel(-2, -1, size)],
  ['gate-woods', 'mid-west', 'river', 'mid-west', axialToPixel(-1, -1, size), axialToPixel(-2, 0, size)],
  ['road-fork', 'upper-gorge', 'river', 'upper-gorge', axialToPixel(0, -2, size), axialToPixel(-1, -2, size)],
]

let failed = 0
for (const [fromId, toId, expectBlocked, expectActive, fromPosOverride, toPosOverride] of CASES) {
  const result = resolve(fromId, toId, fromPosOverride, toPosOverride)
  const ok =
    result.blockedKind === expectBlocked &&
    result.activeHexId === expectActive
  if (!ok) failed++
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${fromId} -> ${toId}: blocked=${result.blockedKind ?? '-'} active=${result.activeHexId} expect blocked=${expectBlocked ?? '-'} active=${expectActive}`,
  )
}

if (failed) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${CASES.length} cases passed`)
