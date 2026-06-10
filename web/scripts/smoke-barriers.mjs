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
  })
  console.log(
    `${fromId} -> ${toId}: active=${result.activeHexId} blocked=${result.blockedKind ?? '-'}`,
  )
  return result
}

const nwMove = offRoad('gate-woods', 'north-west')
const cpBlock = offRoad('west-slope', 'center-pines')
const ugMove = offRoad('road-fork', 'upper-gorge')

const fails = []
if (nwMove.activeHexId !== 'north-west') {
  fails.push('gate-woods->north-west should activate north-west')
}
if (cpBlock.blockedKind !== 'fence' || cpBlock.activeHexId !== 'west-slope') {
  fails.push('west-slope->center-pines should block at fence and stay on west-slope')
}
if (ugMove.activeHexId !== 'upper-gorge') {
  fails.push('road-fork->upper-gorge should activate upper-gorge')
}

if (fails.length) {
  console.error('FAILURES:', fails)
  process.exit(1)
}
console.log('All checks passed')
