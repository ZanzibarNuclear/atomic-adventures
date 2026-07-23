/**
 * Barrier passage openings (gate, hole, bridge, ford) — placement, discovery, travel.
 */

import { resolveWaypoint } from './useRoutes.js'
import { BARRIER_OPENING_KINDS, isWaterBarrier } from './useTravelBarriers.js'
import { passageRequirementSatisfied } from './usePassageState.js'

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
  // Canonical water association; stream and river share bridge/ford openings.
  if (kind === 'bridge' || kind === 'ford') return 'stream'
  return null
}

/** True when an opening kind can cross the given barrier kind. */
export function openingMatchesBarrierKind(openingKind, barrierKind) {
  const mapped = barrierKindForOpening(openingKind)
  if (!mapped || !barrierKind) return false
  if (mapped === barrierKind) return true
  return isWaterBarrier(mapped) && isWaterBarrier(barrierKind)
}

/** Barrier kind for a search action — from player state or hidden openings in hex. */
export function searchBarrierKind({ openings = [], atBarrier = null, lastBlocked = null } = {}) {
  if (atBarrier) return atBarrier
  if (lastBlocked) return lastBlocked
  const kinds = new Set(
    openings.map((f) => barrierKindForOpening(f.kind)).filter(Boolean),
  )
  if (kinds.has('fence')) return 'fence'
  if (kinds.has('stream')) return 'stream'
  if (kinds.has('river')) return 'river'
  return null
}

export function searchActionLabel(opts) {
  const kind = typeof opts === 'string' ? opts : searchBarrierKind(opts)
  if (kind === 'fence') return 'Inspect the fence'
  if (kind === 'stream') return 'Search the streambank'
  if (kind === 'river') return 'Search the riverbank'
  return 'Search carefully'
}

/**
 * Player-facing result line after an outdoor barrier search.
 * Returns null when there is no recorded search to describe.
 */
export function describeBarrierSearchResult(lastSearch) {
  if (!lastSearch?.kind) return null
  const foundKinds = lastSearch.foundKinds ?? []
  const waterName = lastSearch.kind === 'river' ? 'river' : 'stream'
  if (foundKinds.includes('hole')) {
    return 'On closer inspection, you have found a hole in the fence.'
  }
  if (foundKinds.includes('ford')) {
    return `You find a shallow ford across the ${waterName}.`
  }
  if (foundKinds.includes('bridge')) {
    return `You notice a bridge spanning the ${waterName}.`
  }
  if (lastSearch.kind === 'fence') {
    return 'You see a sturdy fence covered in ivy.'
  }
  if (isWaterBarrier(lastSearch.kind)) {
    return `You search the ${waterName}bank carefully, but find no safe place to cross.`
  }
  return 'You search carefully, but find nothing new.'
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
        require: f.require ?? null,
        unlock: f.unlock ?? null,
        on_cross: f.on_cross ?? null,
        on_open: f.on_open ?? null,
        visibility: openingVisibility(f),
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
export function buildPassageMarkers(
  mapFeatures,
  hexById,
  size,
  { flags, barriers, passageStates } = {},
) {
  const hasPassageStates = passageStates != null
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
        open:
          f.kind === 'gate'
            ? hasPassageStates
              ? passageStates[f.id] === true
              : passageRequirementSatisfied(f, flags)
            : undefined,
        angle: f.kind === 'gate' ? openingFenceAngleDeg(at, barriers) : undefined,
        boothX: boothAt?.x,
        boothY: boothAt?.y,
      }
    })
    .filter(Boolean)
}

export function visiblePassageMarkers(
  markers,
  { mode, builderView, discoveredHexes, discoveredOpenings, inView },
) {
  if (builderView) return markers
  const hexSet = discoveredHexes instanceof Set ? discoveredHexes : new Set(discoveredHexes ?? [])
  const openingSet = new Set(discoveredOpenings ?? [])
  const clipToView = mode === 'gameplay' && typeof inView === 'function'
  return markers.filter((m) => {
    if (m.visibility === 'hidden') return openingSet.has(m.id)
    if (!m.hex || !hexSet.has(m.hex)) return false
    if (clipToView && !inView(m.hex)) return false
    return true
  })
}
