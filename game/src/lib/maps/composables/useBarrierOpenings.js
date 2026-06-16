/**
 * Barrier passage openings (gate, hole, bridge, ford) — placement, discovery, travel.
 */

import { resolveWaypoint } from './useRoutes.js'
import { featureLabel } from '../../displayLabel.js'
import { BARRIER_OPENING_KINDS } from './useTravelBarriers.js'

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
export function buildPassageMarkers(mapFeatures, hexById, size) {
  return (mapFeatures ?? [])
    .filter((f) => f.at && BARRIER_OPENING_KINDS.has(f.kind))
    .map((f) => {
      const at = resolveOpeningPosition(f.at, hexById, size)
      if (!at) return null
      const labelAt = f.labelAt
        ? resolveOpeningPosition(f.labelAt, hexById, size)
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
        label: featureLabel(f),
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
