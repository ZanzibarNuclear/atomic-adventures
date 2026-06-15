/**
 * Barrier features for hex travel (fence, river, cliff, ravine, …).
 * Crossing is allowed only at authored openings (gate/hole, bridge/ford, …).
 * All moves — along a route or direct hex-to-hex — use the same path-based checks.
 */


import { bankStandAt, hexOnRiverBank, isAdjacentRiverBankPair } from './useRiverBank.js'

const STAND_INSET = 5
const PATH_ORIGIN_EPS = 0.02

const OPENING_RADIUS = {
  gate: 22,
  hole: 14,
  bridge: 14,
  ford: 12,
  stair: 10,
}

/** Which point-feature kinds allow crossing each barrier kind. */
export const BARRIER_OPENINGS = {
  fence: ['gate', 'hole'],
  river: ['bridge', 'ford'],
  cliff: ['stair'],
  ravine: ['bridge'],
}

export const BARRIER_KINDS = Object.keys(BARRIER_OPENINGS)

/** Point features — not drawable / routable polylines. */
export const BARRIER_OPENING_KINDS = new Set(
  Object.values(BARRIER_OPENINGS).flat(),
)

function allowedOpenings(kind) {
  return new Set(BARRIER_OPENINGS[kind] ?? [])
}

/** Do segments AB and CD intersect (strict crossing, not collinear touch)? */
export function segmentsCross(a, b, c, d) {
  const ccw = (p, q, r) => (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x)
  const d1 = ccw(c, d, a)
  const d2 = ccw(c, d, b)
  const d3 = ccw(a, b, c)
  const d4 = ccw(a, b, d)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** Intersection of segment AB with segment CD; t is param along AB in [0, 1]. */
export function segmentIntersection(a, b, c, d) {
  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (Math.abs(denom) < 1e-9) return null
  const t =
    ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom
  const u =
    ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
    t,
  }
}

/** All barrier polylines from feature models. */
export function barrierSegments(featureModels) {
  const segs = []
  for (const m of featureModels) {
    if (!BARRIER_KINDS.includes(m.kind)) continue
    for (let i = 0; i < m.points.length - 1; i++) {
      segs.push({ a: m.points[i], b: m.points[i + 1], kind: m.kind })
    }
  }
  return segs
}

export function fenceSegments(featureModels) {
  return barrierSegments(featureModels).filter((s) => s.kind === 'fence')
}

export function riverSegments(featureModels) {
  return barrierSegments(featureModels).filter((s) => s.kind === 'river')
}

/** Passable points for barrier crossings. */
export function travelOpenings(mapFeatures) {
  return (mapFeatures ?? [])
    .filter((f) => f.at && BARRIER_OPENING_KINDS.has(f.kind))
    .map((f) => ({
      kind: f.kind,
      x: f.at.x,
      y: f.at.y,
      r: f.radius ?? OPENING_RADIUS[f.kind] ?? 12,
    }))
}

export function openingAllows(kind, x, y, openings) {
  const allowed = allowedOpenings(kind)
  return openings.some(
    (o) => allowed.has(o.kind) && Math.hypot(x - o.x, y - o.y) <= o.r,
  )
}

function barrierList(ctx) {
  return ctx.barriers ?? [...(ctx.fences ?? []), ...(ctx.rivers ?? [])]
}

/** First barrier hit along a polyline path; null when none. */
export function firstBlockedOnPath(path, ctx, { skipKinds = [] } = {}) {
  const skip = new Set(skipKinds)
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (const seg of barrierList(ctx)) {
      if (skip.has(seg.kind)) continue
      const cross = segmentIntersection(a, b, seg.a, seg.b)
      if (!cross || cross.t < PATH_ORIGIN_EPS) continue
      if (!openingAllows(seg.kind, cross.x, cross.y, ctx.openings)) {
        return { ...cross, kind: seg.kind, segIndex: i }
      }
    }
  }
  return null
}

/**
 * First barrier hit along `path` whose intersection lies in `hexId`.
 * Used for movement options — barriers in neighboring hexes are ignored.
 */
export function firstBlockedOnPathInHex(path, ctx, hexId, hexAtPoint, { skipKinds = [] } = {}) {
  const skip = new Set(skipKinds)
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (const seg of barrierList(ctx)) {
      if (skip.has(seg.kind)) continue
      const cross = segmentIntersection(a, b, seg.a, seg.b)
      if (!cross || cross.t < PATH_ORIGIN_EPS) continue
      if (!openingAllows(seg.kind, cross.x, cross.y, ctx.openings)) {
        if (hexAtPoint({ x: cross.x, y: cross.y }, hexId) === hexId) {
          return { ...cross, kind: seg.kind, segIndex: i }
        }
      }
    }
  }
  return null
}

/**
 * Path samples from the stand until the walk exits fromHex (includes the
 * first sample outside the departure hex when present).
 */
export function pathInDepartureHex(path, fromHexId, hexAtPoint) {
  if (path.length < 2) return path
  const out = [path[0]]
  for (let i = 1; i < path.length; i++) {
    out.push(path[i])
    if (hexAtPoint(path[i], fromHexId) !== fromHexId) break
  }
  return out
}

/**
 * Barrier blocking exit from the departure hex along `path`, if any.
 * Barriers in neighboring hexes are ignored for movement options.
 */
export function blockedLeavingDepartureHex(path, fromHexId, ctx, hexAtPoint, barrierOpts = {}) {
  const sub = pathInDepartureHex(path, fromHexId, hexAtPoint)
  if (sub.length < 2) return null
  return firstBlockedOnPathInHex(sub, ctx, fromHexId, hexAtPoint, barrierOpts)
}

/**
 * Whether a neighbor should appear as a movement option.
 * All adjacent hexes are offered unless a barrier in the current hex blocks exit.
 */
export function canOfferNeighbor({
  fromHex,
  toHex,
  fromPos,
  toPos,
  path,
  ctx,
  hexAtPoint,
  size,
}) {
  if (!fromHex?.id) return false
  const walkPath = path ?? [fromPos, toPos]
  const skipKinds = barrierSkipKinds(fromHex, toHex, size, ctx)
  return (
    blockedLeavingDepartureHex(walkPath, fromHex.id, ctx, hexAtPoint, { skipKinds }) ===
    null
  )
}

/**
 * Whether a move along `path` is blocked. Returns barrier kind or null.
 * Same rules for route-following and direct hex-to-hex travel.
 */
export function moveBlocked(fromHex, toHex, path, ctx) {
  if (path.length < 2) return null
  const hit = firstBlockedOnPath(path, ctx)
  return hit?.kind ?? null
}

/** Convenience: straight walk from current stand to destination stand. */
export function moveBlockedBetween(fromHex, toHex, fromPos, toPos, ctx) {
  return moveBlocked(fromHex, toHex, [fromPos, toPos], ctx)
}

/** Samples along a route between two hex spans (inclusive). */
export function routeMoveSamples(model, fromSpan, toSpan) {
  const idxs = [
    fromSpan.startIdx,
    fromSpan.endIdx,
    toSpan.startIdx,
    toSpan.endIdx,
  ]
  return model.samples.slice(Math.min(...idxs), Math.max(...idxs) + 1)
}

/** Whether a marked-route move should be hidden / rejected (departure hex only). */
export function isRouteMoveBlocked(fromHex, toHex, pathSamples, ctx, hexAtPoint) {
  if (!fromHex?.id || !hexAtPoint) {
    return moveBlocked(fromHex, toHex, pathSamples, ctx) !== null
  }
  return blockedLeavingDepartureHex(pathSamples, fromHex.id, ctx, hexAtPoint) !== null
}

function standBeforeHit(from, hit) {
  const dx = from.x - hit.x
  const dy = from.y - hit.y
  const len = Math.hypot(dx, dy)
  if (len < 1) {
    return { x: hit.x, y: hit.y }
  }
  return {
    x: hit.x + (dx / len) * STAND_INSET,
    y: hit.y + (dy / len) * STAND_INSET,
  }
}

function riverSegs(ctx) {
  return barrierList(ctx).filter((s) => s.kind === 'river')
}

/** Adjacent hexes on the same bank — movement is along the river, not across it. */
function parallelRiverBankMove(fromHex, toHex, size, ctx) {
  const rivers = riverSegs(ctx)
  return !!(size && rivers.length && isAdjacentRiverBankPair(fromHex, toHex, size, rivers))
}

function barrierSkipKinds(fromHex, toHex, size, ctx) {
  return parallelRiverBankMove(fromHex, toHex, size, ctx) ? ['river'] : []
}

/**
 * Entering a river hex from a non-river hex stops at the near bank.
 * Bank-to-bank moves along the same q column (parallel to the river) pass through.
 * Path/polyline intersection alone misses this because bank stands sit east of the river.
 */
function riverEntryBlock(fromHex, toHex, size, ctx) {
  const rivers = riverSegs(ctx)
  if (!rivers.length || !hexOnRiverBank(toHex, size, rivers)) return null
  // Moves starting on a river hex don't use the entry rule (parallel bank walks, leaving east).
  if (hexOnRiverBank(fromHex, size, rivers)) return null

  const bank = bankStandAt(toHex, size, rivers)
  if (!bank) return null
  return { stand: bank, blockedKind: 'river' }
}

/**
 * Resolve a move: walk `path` until a barrier stops the avatar.
 * Active hex = whichever hex contains the final stand point.
 */
export function resolveMove({
  fromHex,
  toHex,
  fromPos,
  toPos,
  path,
  ctx,
  hexAtPoint,
  size,
}) {
  const walkPath = path ?? [fromPos, toPos]
  const skipKinds = barrierSkipKinds(fromHex, toHex, size, ctx)
  const fallbackHexId = toHex?.id ?? fromHex?.id

  if (walkPath.length < 2) {
    return {
      stand: toPos,
      activeHexId: hexAtPoint(toPos, fallbackHexId),
      blockedKind: null,
    }
  }

  const hit = firstBlockedOnPath(walkPath, ctx, { skipKinds })
  let blockedKind = hit?.kind ?? null
  let stand

  if (hit) {
    const segStart = walkPath[hit.segIndex] ?? fromPos
    stand = standBeforeHit(segStart, hit)
  } else {
    const riverEntry = riverEntryBlock(fromHex, toHex, size, ctx)
    if (riverEntry) {
      blockedKind = riverEntry.blockedKind
      stand = riverEntry.stand
    } else {
      stand = toPos
    }
  }

  // Blocked at a barrier while entering toHex — stand at the boundary but the
  // active tile is the destination (reveals fog, matches where the player clicked).
  const activeHexId =
    hit && blockedKind
      ? (toHex?.id ?? hexAtPoint(stand, fallbackHexId))
      : hexAtPoint(stand, fallbackHexId)

  return {
    stand,
    activeHexId,
    blockedKind,
  }
}

/** Whether a move ends on the destination hex (may stop at an in-hex barrier). */
export function canEnterNeighbor({
  fromHex,
  toHex,
  fromPos,
  toPos,
  path,
  ctx,
  hexAtPoint,
  size,
}) {
  const result = resolveMove({
    fromHex,
    toHex,
    fromPos,
    toPos,
    path,
    ctx,
    hexAtPoint,
    size,
  })
  return result.activeHexId === toHex.id
}

/** Whether the player fully arrives at the destination stand with no barrier stop. */
export function canReachNeighbor({
  fromHex,
  toHex,
  fromPos,
  toPos,
  path,
  ctx,
  hexAtPoint,
  size,
}) {
  const result = resolveMove({
    fromHex,
    toHex,
    fromPos,
    toPos,
    path,
    ctx,
    hexAtPoint,
    size,
  })
  return !result.blockedKind && result.activeHexId === toHex.id
}
