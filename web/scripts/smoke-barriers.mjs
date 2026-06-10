import mapData from '../content/world/map.yaml'
import { buildRouteModels } from '../src/composables/useRoutes.js'
import { pixelToHex } from '../src/composables/useHexGeometry.js'
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

function offRoad(fromId, toId, fromPosOverride) {
  const from = hexById[fromId]
  const to = hexById[toId]
  const fromPos = fromPosOverride ?? resolveAvatarPosition(from, size, rivers)
  const toPos = resolveAvatarPosition(to, size, rivers)
  const result = resolveMove({
    fromHex: from,
    toHex: to,
    fromPos,
    toPos,
    path: [fromPos, toPos],
    ctx,
    hexAtPoint,
    size,
  })
  console.log(
    `${fromId} -> ${toId}: active=${result.activeHexId} blocked=${result.blockedKind ?? '-'}`,
  )
  return result
}

const nwMove = offRoad('gate-woods', 'north-west')
const cpBlock = offRoad('west-slope', 'center-pines')
const ugMove = offRoad('road-fork', 'upper-gorge')

const spBlock = offRoad('lower-stand', 'south-pines')
const cpEnter = offRoad('center-pines', 'south-pines')

const fails = []
if (nwMove.blockedKind !== 'river' || nwMove.activeHexId !== 'north-west') {
  fails.push('gate-woods->north-west should block at river and activate north-west')
}
if (cpBlock.blockedKind !== 'fence' || cpBlock.activeHexId !== 'west-slope') {
  fails.push('west-slope->center-pines should block at fence and stay on west-slope')
}
if (ugMove.blockedKind !== 'river' || ugMove.activeHexId !== 'upper-gorge') {
  fails.push('road-fork->upper-gorge should block at river and activate upper-gorge')
}
const parallel = offRoad('mid-west', 'north-west')
if (parallel.blockedKind != null) {
  fails.push('mid-west->north-west should pass along the river column')
}
if (spBlock.blockedKind !== 'fence' || spBlock.activeHexId !== 'south-pines') {
  fails.push('lower-stand->south-pines should block at fence and activate south-pines')
}
if (cpEnter.blockedKind !== 'fence' || cpEnter.activeHexId !== 'south-pines') {
  fails.push('center-pines->south-pines should block at fence and activate south-pines')
}

if (fails.length) {
  console.error('FAILURES:', fails)
  process.exit(1)
}
console.log('All checks passed')
