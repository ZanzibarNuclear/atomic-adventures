/**
 * In-hex passage crossings — gate, hole, bridge, ford.
 * Crossings move the avatar to the other side of a barrier within the same hex.
 */

import {
  barrierKindForOpening,
  travelOpenings,
} from './useBarrierOpenings.js'
import { featureLabel } from '../../displayLabel.js'
import { pointInHexPolygon, sideOfLine } from './useTravelBarriers.js'
import {
  distToBarrierKind,
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
  const fromSide = sideOfLine(fromPos, seg.a, seg.b)
  const farSide = sideOfLine(farStand, seg.a, seg.b)
  const alternateSide = sideOfLine(alternateStand, seg.a, seg.b)
  if (fromSide * farSide >= 0 && fromSide * alternateSide < 0) {
    return alternateStand
  }

  return farStand
}

function passageStandCandidates(opening, fromPos, ctx, size) {
  const ideal = standAcrossOpening(opening, fromPos, ctx, size)
  if (!ideal) return []
  const candidates = [ideal]
  for (let angle = 0; angle < 360; angle += 30) {
    for (let dist = 2; dist <= PASSAGE_CROSSING_INSET + 10; dist += 2) {
      const rad = (angle * Math.PI) / 180
      candidates.push({
        x: ideal.x + Math.cos(rad) * dist,
        y: ideal.y + Math.sin(rad) * dist,
      })
    }
  }
  return candidates
}

/**
 * Stand after crossing a passage — ideal inset first, then nearest legal point
 * that stays in the hex, on the far side of the barrier, near the opening.
 */
export function resolvePassageStand(opening, fromPos, ctx, size, hex) {
  const kind = barrierKindForOpening(opening.kind)
  if (!kind || !hex) return null
  const near = nearestBarrierSegment(opening, kind, ctx.barriers)
  if (!near) return null
  const { seg } = near
  const fromSide = sideOfLine(fromPos, seg.a, seg.b)
  const minSeparation = PASSAGE_CROSSING_INSET * 0.55

  for (const stand of passageStandCandidates(opening, fromPos, ctx, size)) {
    if (!pointInHexPolygon(stand, hex, size)) continue
    if (Math.hypot(stand.x - fromPos.x, stand.y - fromPos.y) < 1) continue
    const toSide = sideOfLine(stand, seg.a, seg.b)
    if (Math.abs(fromSide) > 0.5 && fromSide * toSide >= 0) continue
    const separation = distToBarrierKind(stand, kind, ctx.barriers)
    if (separation == null || separation < minSeparation) continue
    return stand
  }
  return null
}

/** Whether the player can cross to the other side of this opening (toggle). */
export function shouldOfferPassageCrossing(opening, fromPos, ctx, atBarrier) {
  const kind = barrierKindForOpening(opening.kind)
  if (!kind) return false
  if (atBarrier && atBarrier !== kind) return false

  const stand = standAcrossOpening(opening, fromPos, ctx)
  if (!stand) return false
  if (Math.hypot(stand.x - fromPos.x, stand.y - fromPos.y) < 1) return false

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
