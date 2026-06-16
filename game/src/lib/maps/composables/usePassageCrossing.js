/**
 * In-hex passage crossings — gate, hole, bridge, ford.
 * Crossings move the avatar to the other side of a barrier within the same hex.
 */

import {
  barrierKindForOpening,
  travelOpenings,
} from './useBarrierOpenings.js'
import { featureLabel } from '../../displayLabel.js'
import { sideOfLine, segmentIntersection } from './useTravelBarriers.js'
import {
  BARRIER_STAND_INSET,
  barrierXAtY,
  standBesideBarrierLine,
} from './useBarrierStand.js'

const PASSAGE_LABELS = {
  bridge: 'Cross the bridge',
  ford: 'Cross the ford',
  gate: 'Go through the gate',
  hole: 'Go through the hole',
}

function barrierSegmentsOfKind(kind, barriers) {
  return (barriers ?? []).filter((seg) => seg.kind === kind)
}

function nearestBarrierSegment(point, kind, barriers) {
  let best = null
  let bestDist = Infinity
  for (const seg of barriers ?? []) {
    if (seg.kind !== kind) continue
    const cross =
      segmentIntersection(
        { x: point.x - 1, y: point.y },
        { x: point.x + 1, y: point.y },
        seg.a,
        seg.b,
      ) ??
      segmentIntersection(
        { x: point.x, y: point.y - 1 },
        { x: point.x, y: point.y + 1 },
        seg.a,
        seg.b,
      )
    const ax = cross ? cross.x : (seg.a.x + seg.b.x) / 2
    const ay = cross ? cross.y : (seg.a.y + seg.b.y) / 2
    const d = Math.hypot(point.x - ax, point.y - ay)
    if (d < bestDist) {
      bestDist = d
      best = { seg, anchor: { x: ax, y: ay } }
    }
  }
  return best
}

function riverXAtY(kind, y, barriers) {
  return barrierXAtY(barrierSegmentsOfKind(kind, barriers), y)
}

function riverXNearOpening(opening, barriers) {
  return riverXAtY('river', opening.y, barriers)
}

function standAcrossRiver(opening, fromPos, ctx, size = 44) {
  const riverX = riverXNearOpening(opening, ctx.barriers)
  if (riverX == null) return null
  const onEast = fromPos.x > riverX
  if (onEast) {
    return {
      x: riverX - size * 0.55,
      y: opening.y - size * 0.04,
    }
  }
  return standBesideBarrierLine({
    xAtY: riverX,
    side: 'east',
    y: opening.y,
    inset: BARRIER_STAND_INSET.river,
  })
}

function isWestOfRiverAt(fromPos, barriers) {
  const riverX = riverXAtY('river', fromPos.y, barriers)
  return riverX != null && fromPos.x < riverX - 1
}

function isEastOfRiverAt(fromPos, barriers) {
  const riverX = riverXAtY('river', fromPos.y, barriers)
  return riverX != null && fromPos.x > riverX + 1
}

function isOnRiverBank(fromPos, barriers) {
  const riverX = riverXAtY('river', fromPos.y, barriers)
  if (riverX == null) return false
  return Math.abs(fromPos.x - riverX) > 1
}

export { isWestOfRiverAt, isEastOfRiverAt, isOnRiverBank }

/** Stand on the far side of the barrier from `fromPos`, at an opening. */
export function standAcrossOpening(opening, fromPos, ctx, size = 44) {
  const kind = barrierKindForOpening(opening.kind)
  if (kind === 'river') {
    return standAcrossRiver(opening, fromPos, ctx, size)
  }

  const near = nearestBarrierSegment(opening, kind, ctx.barriers)
  if (!near) return null

  const { seg, anchor } = near
  const inset = BARRIER_STAND_INSET[kind] ?? 5
  const tx = seg.b.x - seg.a.x
  const ty = seg.b.y - seg.a.y
  const len = Math.hypot(tx, ty) || 1
  let nx = -ty / len
  let ny = tx / len

  const towardFrom =
    (fromPos.x - anchor.x) * nx + (fromPos.y - anchor.y) * ny
  if (towardFrom < 0) {
    nx = -nx
    ny = -ny
  }

  return {
    x: anchor.x - nx * inset,
    y: anchor.y - ny * inset,
  }
}

/** Whether the player can cross to the other side of this opening (toggle). */
export function shouldOfferPassageCrossing(opening, fromPos, ctx, atBarrier) {
  const kind = barrierKindForOpening(opening.kind)
  if (!kind) return false
  if (atBarrier && atBarrier !== kind) return false
  if (atBarrier === kind) return true

  const stand = standAcrossOpening(opening, fromPos, ctx)
  if (!stand) return false
  if (Math.hypot(stand.x - fromPos.x, stand.y - fromPos.y) < 1) return false

  if (kind === 'river') {
    return isOnRiverBank(fromPos, ctx.barriers)
  }

  const near = nearestBarrierSegment(fromPos, kind, ctx.barriers)
  if (!near) return false
  const fromSide = sideOfLine(fromPos, near.seg.a, near.seg.b)
  if (Math.abs(fromSide) <= 0.5) return true
  const toSide = sideOfLine(stand, near.seg.a, near.seg.b)
  return fromSide * toSide < 0
}

export function passageCrossingLabel(opening) {
  return PASSAGE_LABELS[opening.kind] ?? featureLabel({ kind: opening.kind })
}

/** Passage crossings available in the current hex from `fromPos`. */
export function availablePassageCrossings({
  hexId,
  fromPos,
  mapFeatures,
  ctx,
  hexById,
  size,
  discoveredOpenings = [],
  atBarrier = null,
}) {
  return travelOpenings(mapFeatures, { hexById, size, discoveredOpenings })
    .filter((opening) => {
      const feature = (mapFeatures ?? []).find((f) => f.id === opening.id)
      return feature?.hex === hexId
    })
    .filter((opening) =>
      shouldOfferPassageCrossing(opening, fromPos, ctx, atBarrier),
    )
    .map((opening) => ({
      openingId: opening.id,
      kind: opening.kind,
      barrierKind: barrierKindForOpening(opening.kind),
      label: passageCrossingLabel(opening),
    }))
}
