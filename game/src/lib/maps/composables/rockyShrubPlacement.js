import { pixelToHex } from './useHexGeometry.js'

const TARGET_MIN = 7
const TARGET_MAX = 11
const MAX_ATTEMPTS = 80
const HEX_FILL_RATIO = 0.58
const MIN_SPACING_RATIO = 0.15

const FEATURE_BUFFER = {
  river: 13,
  road: 11,
  drive: 10,
  path: 9,
  trail: 9,
  fence: 8,
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
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
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
    min = Math.min(min, distToSegment(px, py, a.x, a.y, b.x, b.y))
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

function isNearFeature(px, py, features) {
  for (const feature of features) {
    const buffer = FEATURE_BUFFER[feature.kind] ?? 7
    if (distToSamples(px, py, feature.samples) < buffer) return true
  }
  return false
}

function buildSceneryForHex(hex, center, size, rng, features) {
  const c = center(hex)
  const target = TARGET_MIN + Math.floor(rng() * (TARGET_MAX - TARGET_MIN + 1))
  const minDist = MIN_SPACING_RATIO * size
  const placed = []

  for (let attempt = 0; attempt < MAX_ATTEMPTS && placed.length < target; attempt++) {
    const angle = rng() * Math.PI * 2
    const radius = Math.sqrt(rng()) * HEX_FILL_RATIO * size
    const x = c.x + Math.cos(angle) * radius
    const y = c.y + Math.sin(angle) * radius * 0.82

    if (!inHex(x, y, hex, size)) continue
    if (isNearFeature(x, y, features)) continue
    if (placed.some((item) => Math.hypot(item.x - x, item.y - y) < minDist)) continue

    placed.push({
      key: `${hex.id}-rock-shrub-${placed.length}`,
      x,
      y,
      kind: rng() > 0.42 ? 'shrub' : 'rock',
      scale: (0.68 + rng() * 0.5) * (size / 44),
      rotate: Math.round(rng() * 360),
    })
  }

  return placed
}

/** Deterministic low scenery for exposed rocky terrain with sparse shrubs. */
export function buildRockyShrubScenery({
  visibleHexes,
  routeModels,
  featureModels,
  size,
  center,
}) {
  const allModels = [...routeModels, ...featureModels]
  const out = []

  for (const hex of visibleHexes) {
    if (hex.terrain !== 'gorge') continue
    const touching = modelsTouchingHex(hex.id, allModels).map((model) => ({
      kind: model.kind,
      samples: hexSamples(model, hex.id),
    }))
    const rng = mulberry32(hashStr(`${hex.id}:gorge`))
    out.push(...buildSceneryForHex(hex, center, size, rng, touching))
  }

  return out.sort((a, b) => a.y - b.y)
}
