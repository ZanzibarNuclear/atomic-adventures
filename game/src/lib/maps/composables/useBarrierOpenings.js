/**
 * Barrier passage openings (gate, hole, bridge, ford) — placement, discovery, travel.
 */

import { resolveWaypoint } from './useRoutes.js'
import { isGateOpeningOpen } from './useCompoundGate.js'
import { BARRIER_OPENING_KINDS } from './useTravelBarriers.js'

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function nearestFenceSegment(point, barriers) {
  let best = null
  let bestDist = Infinity
  for (const seg of barriers ?? []) {
    if (seg.kind !== 'fence') continue
    const d = distToSegment(point.x, point.y, seg.a.x, seg.a.y, seg.b.x, seg.b.y)
    if (d < bestDist) {
      bestDist = d
      best = seg
    }
  }
  return best
}

/** Degrees to rotate gate/hole-style symbols so local +X aligns with the fence tangent. */
export function openingFenceAngleDeg(point, barriers) {
  const seg = nearestFenceSegment(point, barriers)
  if (!seg) return 90
  const dx = seg.b.x - seg.a.x
  const dy = seg.b.y - seg.a.y
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

export const OPENING_RADIUS = {
  gate: 22,
  hole: 14,
  bridge: 14,
  ford: 12,
  stair: 10,
}

/** @typedef {'obvious' | 'hidden'} OpeningVisibility */

export function openingVisibility(feature) {
  return feature.visibility ?? 'obvious'
}

export function barrierKindForOpening(kind) {
  if (kind === 'gate' || kind === 'hole') return 'fence'
  if (kind === 'bridge' || kind === 'ford') return 'river'
  return null
}

/** Barrier kind for a search action — from player state or hidden openings in hex. */
export function searchBarrierKind({ openings = [], atBarrier = null, lastBlocked = null } = {}) {
  if (atBarrier) return atBarrier
  if (lastBlocked) return lastBlocked
  const kinds = new Set(
    openings.map((f) => barrierKindForOpening(f.kind)).filter(Boolean),
  )
  if (kinds.has('fence')) return 'fence'
  if (kinds.has('river')) return 'river'
  return null
}

export function searchActionLabel(opts) {
  const kind = searchBarrierKind(opts)
  if (kind === 'fence') return 'Search along the fence'
  if (kind === 'river') return 'Search the riverbank'
  return 'Search carefully'
}

/** Resolve opening anchor to world pixels (hex-anchored or raw x/y). */
export function resolveOpeningPosition(at, hexById, size) {
  if (!at) return null
  if (at.x != null && at.y != null && at.hex === undefined) {
    return { x: at.x, y: at.y }
  }
  if (at.hex && hexById?.[at.hex]) {
    return resolveWaypoint(at, hexById, size)
  }
  return null
}

/**
 * Passable opening circles for barrier crossing.
 * Hidden openings are omitted until their feature id is in discoveredOpenings.
 */
export function travelOpenings(
  mapFeatures,
  { hexById, size, discoveredOpenings = [] } = {},
) {
  const discovered = new Set(discoveredOpenings ?? [])
  return (mapFeatures ?? [])
    .filter((f) => f.at && BARRIER_OPENING_KINDS.has(f.kind))
    .filter((f) => {
      if (openingVisibility(f) === 'obvious') return true
      return discovered.has(f.id)
    })
    .map((f) => {
      const pos = resolveOpeningPosition(f.at, hexById, size)
      if (!pos) return null
      return {
        id: f.id,
        kind: f.kind,
        hex: f.hex,
        x: pos.x,
        y: pos.y,
        r: f.radius ?? OPENING_RADIUS[f.kind] ?? 12,
      }
    })
    .filter(Boolean)
}

/** Hidden openings in a hex not yet revealed by search. */
export function hiddenOpeningsInHex(mapFeatures, hexId, discoveredOpenings = []) {
  const discovered = new Set(discoveredOpenings ?? [])
  return (mapFeatures ?? []).filter(
    (f) =>
      f.at &&
      BARRIER_OPENING_KINDS.has(f.kind) &&
      f.hex === hexId &&
      openingVisibility(f) === 'hidden' &&
      !discovered.has(f.id),
  )
}

/** Build passage marker models for map rendering. */
export function buildPassageMarkers(mapFeatures, hexById, size, { flags, barriers } = {}) {
  return (mapFeatures ?? [])
    .filter((f) => f.at && BARRIER_OPENING_KINDS.has(f.kind))
    .map((f) => {
      const at = resolveOpeningPosition(f.at, hexById, size)
      if (!at) return null
      const labelAt = f.labelAt
        ? resolveOpeningPosition(f.labelAt, hexById, size)
        : null
      const boothAt = f.boothAt
        ? resolveOpeningPosition(f.boothAt, hexById, size)
        : null
      return {
        id: f.id,
        kind: f.kind,
        hex: f.hex ?? null,
        visibility: openingVisibility(f),
        x: at.x,
        y: at.y,
        labelX: labelAt?.x ?? at.x,
        labelY: labelAt?.y ?? at.y + 12,
        label: f.label ?? '',
        open: f.kind === 'gate' ? isGateOpeningOpen(f.id, flags) : undefined,
        angle: f.kind === 'gate' ? openingFenceAngleDeg(at, barriers) : undefined,
        boothX: boothAt?.x,
        boothY: boothAt?.y,
      }
    })
    .filter(Boolean)
}

export function visiblePassageMarkers(
  markers,
  { mode, builderView, discoveredHexes, discoveredOpenings },
) {
  if (mode === 'full' || builderView) return markers
  const hexSet = discoveredHexes instanceof Set ? discoveredHexes : new Set(discoveredHexes ?? [])
  const openingSet = new Set(discoveredOpenings ?? [])
  return markers.filter((m) => {
    if (m.visibility === 'hidden') return openingSet.has(m.id)
    return !m.hex || hexSet.has(m.hex)
  })
}
