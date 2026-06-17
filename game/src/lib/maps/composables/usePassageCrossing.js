/**
 * In-hex passage crossings — gate, hole, bridge, ford.
 * Crossings move the avatar to the other side of a barrier within the same hex.
 */

import {
  barrierKindForOpening,
  travelOpenings,
} from './useBarrierOpenings.js'
import { featureLabel } from '../../displayLabel.js'
import { sideOfLine } from './useTravelBarriers.js'
import {
  barrierXAtY,
  isNearBarrierKind,
} from './useBarrierStand.js'

const PASSAGE_LABELS = {
  bridge: 'Cross the bridge',
  ford: 'Cross the ford',
  gate: 'Go through the gate',
  hole: 'Go through the hole',
}

/** Shared separation after crossing any passage type. */
export const PASSAGE_CROSSING_INSET = 12

function barrierSegmentsOfKind(kind, barriers) {
  return (barriers ?? []).filter((seg) => seg.kind === kind)
}

function nearestPointOnSegment(point, seg) {
  const vx = seg.b.x - seg.a.x
  const vy = seg.b.y - seg.a.y
  const wx = point.x - seg.a.x
  const wy = point.y - seg.a.y
  const denom = vx * vx + vy * vy || 1
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / denom))
  return {
    x: seg.a.x + vx * t,
    y: seg.a.y + vy * t,
  }
}

function nearestBarrierSegment(point, kind, barriers) {
  let best = null
  let bestDist = Infinity
  for (const seg of barriers ?? []) {
    if (seg.kind !== kind) continue
    const anchor = nearestPointOnSegment(point, seg)
    const d = Math.hypot(point.x - anchor.x, point.y - anchor.y)
    if (d < bestDist) {
      bestDist = d
      best = { seg, anchor }
    }
  }
  return best
}

function riverXAtY(kind, y, barriers) {
  return barrierXAtY(barrierSegmentsOfKind(kind, barriers), y)
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
  return isNearBarrierKind(fromPos, 'river', barriers)
}

export { isWestOfRiverAt, isEastOfRiverAt, isOnRiverBank }

/** Stand on the far side of the barrier from `fromPos`, at an opening. */
export function standAcrossOpening(opening, fromPos, ctx, size = 44) {
  const kind = barrierKindForOpening(opening.kind)
  const near = nearestBarrierSegment(opening, kind, ctx.barriers)
  if (!near) return null

  const { seg, anchor } = near
  const inset = PASSAGE_CROSSING_INSET
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

  const farStand = {
    x: anchor.x - nx * inset,
    y: anchor.y - ny * inset,
  }
  const alternateStand = {
    x: anchor.x + nx * inset,
    y: anchor.y + ny * inset,
  }

  if (kind === 'river') {
    if (
      isWestOfRiverAt(fromPos, ctx.barriers) &&
      !isEastOfRiverAt(farStand, ctx.barriers) &&
      isEastOfRiverAt(alternateStand, ctx.barriers)
    ) {
      return alternateStand
    }
    if (
      isEastOfRiverAt(fromPos, ctx.barriers) &&
      !isWestOfRiverAt(farStand, ctx.barriers) &&
      isWestOfRiverAt(alternateStand, ctx.barriers)
    ) {
      return alternateStand
    }
  }

  return farStand
}

/** Whether the player can cross to the other side of this opening (toggle). */
export function shouldOfferPassageCrossing(opening, fromPos, ctx, atBarrier) {
  const kind = barrierKindForOpening(opening.kind)
  if (!kind) return false
  if (atBarrier && atBarrier !== kind) return false

  const stand = standAcrossOpening(opening, fromPos, ctx)
  if (!stand) return false
  if (Math.hypot(stand.x - fromPos.x, stand.y - fromPos.y) < 1) return false

  if (kind === 'river') {
    return isOnRiverBank(fromPos, ctx.barriers)
  }

  if (!isNearBarrierKind(fromPos, kind, ctx.barriers)) return false

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
  const openings =
    ctx?.openings ??
    travelOpenings(mapFeatures, { hexById, size, discoveredOpenings })
  return openings
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
