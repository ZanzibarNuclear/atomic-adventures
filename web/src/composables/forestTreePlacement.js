import { pixelToHex } from './useHexGeometry.js'
import { landmarkAnchor } from './useAvatarStand.js'

const MIN_TREE_SPACING_RATIO = 0.24
const MAX_ATTEMPTS = 56
const TARGET_MIN = 4
const TARGET_MAX = 7
const HEX_FILL_RATIO = 0.52

const FEATURE_BUFFER = {
  river: 15,
  road: 14,
  drive: 12,
  path: 11,
  trail: 11,
  fence: 10,
}

const GATE_EXCLUSION_RADIUS = 20

const BUILDING_EXCLUSION = {
  'utility-station': { rx: 30, ry: 24, scale: 0.54 },
}

function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function distToSamples(px, py, samples) {
  if (samples.length < 2) {
    if (!samples.length) return Infinity
    return Math.hypot(px - samples[0].x, py - samples[0].y)
  }
  let min = Infinity
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]
    const b = samples[i + 1]
    const d = distToSegment(px, py, a.x, a.y, b.x, b.y)
    if (d < min) min = d
  }
  return min
}

function inHex(px, py, hex, size) {
  const { q, r } = pixelToHex(px, py, size)
  return q === hex.q && r === hex.r
}

function modelsTouchingHex(hexId, models) {
  return models.filter((m) => m.samples?.some((s) => s.hexId === hexId))
}

function hexSamples(model, hexId) {
  return model.samples.filter((s) => s.hexId === hexId)
}

function gateExclusions(hexId, mapFeatures) {
  return (mapFeatures ?? [])
    .filter((f) => f.kind === 'gate' && f.at && (!f.hex || f.hex === hexId))
    .map((f) => ({ x: f.at.x, y: f.at.y, r: GATE_EXCLUSION_RADIUS }))
}

function landmarkExclusions(hex, size) {
  const building = hex.landmark?.building
  if (!building) return []
  const spec = BUILDING_EXCLUSION[building]
  if (!spec) return []
  const anchor = landmarkAnchor(hex, size)
  const s = spec.scale ?? 1
  return [{ x: anchor.x, y: anchor.y, rx: spec.rx * s, ry: spec.ry * s }]
}

function nearCircle(px, py, circle) {
  return Math.hypot(px - circle.x, py - circle.y) < circle.r
}

function nearEllipse(px, py, ellipse) {
  const dx = (px - ellipse.x) / ellipse.rx
  const dy = (py - ellipse.y) / ellipse.ry
  return dx * dx + dy * dy < 1
}

function isExcluded(px, py, linearFeatures, circles, ellipses) {
  for (const f of linearFeatures) {
    const buffer = FEATURE_BUFFER[f.kind] ?? 8
    if (distToSamples(px, py, f.samples) < buffer) return true
  }
  for (const c of circles) {
    if (nearCircle(px, py, c)) return true
  }
  for (const e of ellipses) {
    if (nearEllipse(px, py, e)) return true
  }
  return false
}

function placeTreesInHex(hex, center, size, rng, linearFeatures, circles, ellipses) {
  const c = center(hex)
  const minDist = MIN_TREE_SPACING_RATIO * size
  const target = TARGET_MIN + Math.floor(rng() * (TARGET_MAX - TARGET_MIN + 1))
  const placed = []

  for (let attempt = 0; attempt < MAX_ATTEMPTS && placed.length < target; attempt++) {
    const ang = rng() * Math.PI * 2
    const rad = Math.sqrt(rng()) * HEX_FILL_RATIO * size
    const x = c.x + Math.cos(ang) * rad
    const y = c.y + Math.sin(ang) * rad * 0.85

    if (!inHex(x, y, hex, size)) continue
    if (isExcluded(x, y, linearFeatures, circles, ellipses)) continue
    if (placed.some((t) => Math.hypot(t.x - x, t.y - y) < minDist)) continue

    placed.push({
      key: `${hex.id}-${placed.length}`,
      x,
      y,
      scale: (0.7 + rng() * 0.5) * (size / 44),
    })
  }

  return placed
}

/**
 * Deterministic forest scatter: minimum tree spacing plus clearance from
 * roads, rivers, trails, fences, gates, and landmark footprints.
 */
export function buildForestTrees({
  visibleHexes,
  routeModels,
  featureModels,
  mapFeatures,
  size,
  center,
}) {
  const allModels = [...routeModels, ...featureModels]
  const out = []

  for (const hex of visibleHexes) {
    if (hex.terrain !== 'forest') continue
    const rng = mulberry32(hashStr(hex.id))
    const touching = modelsTouchingHex(hex.id, allModels)
    const linearFeatures = touching.map((m) => ({
      kind: m.kind,
      samples: hexSamples(m, hex.id),
    }))
    const circles = gateExclusions(hex.id, mapFeatures)
    const ellipses = landmarkExclusions(hex, size)

    out.push(
      ...placeTreesInHex(hex, center, size, rng, linearFeatures, circles, ellipses),
    )
  }

  return out.sort((a, b) => a.y - b.y)
}
