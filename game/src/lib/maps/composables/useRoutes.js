// Routes are continuous polylines in world space, NOT hex-to-hex spines.
// The path's own geometry decides:
//   - which hexes "light up" (the hex each point along the path falls in), and
//   - the travel direction (the path's heading / tangent).
// So a path can run due north while passing through a hex that sits to the
// northwest — the hex lights up, but the reported direction is still north.

import { routeLabel } from "../../displayLabel.js";
import { axialToPixel, pixelToHex, hexDistance } from './useHexGeometry.js'

const COMPASS = [
  { name: 'east', center: 0 },
  { name: 'northeast', center: 45 },
  { name: 'north', center: 90 },
  { name: 'northwest', center: 135 },
  { name: 'west', center: 180 },
  { name: 'southwest', center: 225 },
  { name: 'south', center: 270 },
  { name: 'southeast', center: 315 },
]

// Compass word from a screen-space direction vector.
// Screen-y grows downward, so negate dy to make "up" = north.
function bearingFromVector(dx, dy) {
  let deg = (Math.atan2(-dy, dx) * 180) / Math.PI
  if (deg < 0) deg += 360
  let best = COMPASS[0]
  let bestDelta = 360
  for (const c of COMPASS) {
    const d = Math.abs(((deg - c.center + 540) % 360) - 180)
    if (d < bestDelta) {
      bestDelta = d
      best = c
    }
  }
  return best.name
}

// Direction between two hex centers (direct hex-to-hex moves with no route polyline).
export function bearingLabel(from, to, size) {
  const a = axialToPixel(from.q, from.r, size)
  const b = axialToPixel(to.q, to.r, size)
  return bearingFromVector(b.x - a.x, b.y - a.y)
}

// A waypoint is anchored to a hex with an optional offset (in hex-size units),
// or given as raw world coords. This keeps authoring readable while letting the
// path sit anywhere — off-center, cutting across hexes, etc.
export function resolveWaypoint(wp, hexById, size) {
  if (wp.x !== undefined && wp.y !== undefined && wp.hex === undefined) {
    return { x: wp.x, y: wp.y }
  }
  const h = hexById[wp.hex]
  const c = axialToPixel(h.q, h.r, size)
  return { x: c.x + (wp.dx ?? 0) * size, y: c.y + (wp.dy ?? 0) * size }
}

// Catmull-Rom spline through the control points -> a smooth, curvy polyline.
// Endpoints are clamped (duplicated) so the curve starts/ends at the controls.
export function catmullRomSpline(ctrl, perSeg = 18) {
  if (ctrl.length < 3) return ctrl
  const out = []
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[i - 1] ?? ctrl[i]
    const p1 = ctrl[i]
    const p2 = ctrl[i + 1]
    const p3 = ctrl[i + 2] ?? ctrl[i + 1]
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  out.push(ctrl[ctrl.length - 1])
  return out
}

function resolvePolyline(route, hexById, size) {
  const ctrl = (route.points ?? []).map((wp) => resolveWaypoint(wp, hexById, size))
  return route.smooth ? catmullRomSpline(ctrl) : ctrl
}

// Walk the polyline at a fine step, tagging each sample with the hex it falls in.
function sampleRoute(points, size, coordMap) {
  const step = size / 6
  const samples = []
  let dist = 0
  const tag = (x, y, d) => {
    const { q, r } = pixelToHex(x, y, size)
    samples.push({ x, y, dist: d, hexId: coordMap.get(`${q},${r}`) ?? null })
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const segLen = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.ceil(segLen / step))
    for (let k = 0; k < n; k++) {
      const t = k / n
      tag(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, dist + segLen * t)
    }
    dist += segLen
  }
  const last = points[points.length - 1]
  tag(last.x, last.y, dist)
  return samples
}

function headingVec(samples, i) {
  const a = samples[Math.max(0, i - 1)]
  const b = samples[Math.min(samples.length - 1, i + 1)]
  return { dx: b.x - a.x, dy: b.y - a.y }
}

// Precompute a model per route: resolved polyline, dense samples, and the
// ordered "spans" of hexes the path passes through.
export function buildRouteModels(routes, hexById, hexes, size) {
  const coordMap = new Map(hexes.map((h) => [`${h.q},${h.r}`, h.id]))
  return (routes ?? [])
    .filter((route) => (route.points?.length ?? 0) >= 2)
    .map((route) => {
    const points = resolvePolyline(route, hexById, size)
    if (points.length < 2) return null
    const samples = sampleRoute(points, size, coordMap)
    const spans = []
    for (let i = 0; i < samples.length; i++) {
      const last = spans[spans.length - 1]
      if (last && last.hexId === samples[i].hexId) last.endIdx = i
      else spans.push({ hexId: samples[i].hexId, startIdx: i, endIdx: i })
    }
    return { id: route.id, kind: route.kind, label: routeLabel(route), points, samples, spans }
  })
    .filter(Boolean)
}

function nextSpan(model, fromSpanIdx, dir, currentHexId) {
  for (let i = fromSpanIdx + dir; i >= 0 && i < model.spans.length; i += dir) {
    const s = model.spans[i]
    if (s.hexId && s.hexId !== currentHexId) return s
  }
  return null
}

// Travel options leaving the current hex. The label is the PATH'S heading at
// the point it leaves the current hex — not the hex-to-hex vector.
export function availableMoves(currentHexId, models, travelOpts = null) {
  const moves = []
  const seen = new Set()

  function reachable(toHexId, routeLeg, pathSamples) {
    if (!travelOpts?.fromPos) return true
    const fromHex = travelOpts.fromHex
    const toHex = travelOpts.hexById[toHexId]
    if (!fromHex || !toHex) return false
    const fromPos = travelOpts.fromPos
    const toPos = travelOpts.resolveStand(toHex)
    const path = routeLeg
      ? buildMovePath(
          fromPos,
          fromHex,
          toHex,
          toPos,
          routeLeg,
          travelOpts.routeModels ?? models,
        )
      : pathSamples ?? [fromPos, toPos]
    return canOfferNeighbor({
      fromHex,
      toHex,
      fromPos,
      toPos,
      path,
      ctx: travelOpts.barriers,
      hexAtPoint: travelOpts.hexAtPoint,
      size: travelOpts.size,
    })
  }

  for (const m of models) {
    for (let si = 0; si < m.spans.length; si++) {
      if (m.spans[si].hexId !== currentHexId) continue
      const span = m.spans[si]

      const fwd = nextSpan(m, si, +1, currentHexId)
      if (fwd && !seen.has(fwd.hexId)) {
        const routeLeg = {
          routeId: m.id,
          routeName: m.label,
          kind: m.kind,
          toHexId: fwd.hexId,
        }
        if (
          travelOpts &&
          !reachable(
            fwd.hexId,
            routeLeg,
            routeMoveSamples(m, span, fwd),
          )
        ) {
          continue
        }
        const h = headingVec(m.samples, span.endIdx)
        seen.add(fwd.hexId)
        moves.push({
          routeId: m.id,
          routeName: m.label,
          kind: m.kind,
          toHexId: fwd.hexId,
          label: bearingFromVector(h.dx, h.dy),
        })
      }

      const bwd = nextSpan(m, si, -1, currentHexId)
      if (bwd && !seen.has(bwd.hexId)) {
        const routeLeg = {
          routeId: m.id,
          routeName: m.label,
          kind: m.kind,
          toHexId: bwd.hexId,
        }
        if (
          travelOpts &&
          !reachable(
            bwd.hexId,
            routeLeg,
            routeMoveSamples(m, span, bwd),
          )
        ) {
          continue
        }
        const h = headingVec(m.samples, span.startIdx)
        seen.add(bwd.hexId)
        moves.push({
          routeId: m.id,
          routeName: m.label,
          kind: m.kind,
          toHexId: bwd.hexId,
          label: bearingFromVector(-h.dx, -h.dy),
        })
      }
    }
  }
  return moves
}

// Drawable polyline pieces, masked by fog. A short stub pokes into the first
// fogged hex so the player sees "a path leads off this way".
export function buildRouteDrawPieces(models, { isRevealed, inView, allowStub }) {
  const pieces = []
  for (const m of models) {
    const vis = (s) => s.hexId != null && isRevealed(s.hexId) && inView(s.hexId)
    let run = null
    const flush = () => {
      if (run && run.length >= 2) pieces.push({ kind: m.kind, points: run, partial: false })
      run = null
    }
    for (let i = 0; i < m.samples.length; i++) {
      const s = m.samples[i]
      if (vis(s)) {
        if (!run) run = []
        run.push({ x: s.x, y: s.y })
        // Leading stub backward into a fogged neighbor.
        if (allowStub && run.length === 1 && i > 0) {
          const p = m.samples[i - 1]
          pieces.push({
            kind: m.kind,
            points: [{ x: s.x + (p.x - s.x) * 0.5, y: s.y + (p.y - s.y) * 0.5 }, { x: s.x, y: s.y }],
            partial: true,
          })
        }
      } else {
        if (run && allowStub && run.length >= 1) {
          const p = m.samples[i - 1]
          pieces.push({
            kind: m.kind,
            points: [{ x: p.x, y: p.y }, { x: p.x + (s.x - p.x) * 0.5, y: p.y + (s.y - p.y) * 0.5 }],
            partial: true,
          })
        }
        flush()
      }
    }
    flush()
  }
  return pieces
}

import {
  routeMoveSamples,
  resolveMove,
  canOfferNeighbor,
  canReachNeighbor,
} from './useTravelBarriers.js'

export { fenceSegments, segmentsCross } from './useTravelBarriers.js'

/** Walk path for a move — route polyline or straight line between hex centers. */
export function buildMovePath(fromPos, fromHex, toHex, toPos, routeLeg, routeModels) {
  if (routeLeg) {
    const model = routeModels.find((r) => r.id === routeLeg.routeId)
    const fromSpan = model?.spans.find((s) => s.hexId === fromHex.id)
    const toSpan = model?.spans.find((s) => s.hexId === toHex.id)
    if (model && fromSpan && toSpan) {
      const samples = routeMoveSamples(model, fromSpan, toSpan)
      if (samples.length >= 2) {
        // Use the authored route geometry — do not chord from the avatar
        // position to an interior sample (that can falsely cross fences/rivers).
        return samples
      }
    }
  }
  return [fromPos, toPos]
}

// Adjacent hexes not on a marked route — all neighbors unless a barrier in the
// departure hex blocks exit (barriers in destination hexes are ignored here).
export function directNeighbors(
  currentHexId,
  hexes,
  hexById,
  onRouteTargets,
  size,
  barriers,
  fromPos,
  resolveStand,
  hexAtPoint,
) {
  const current = hexById[currentHexId]
  if (!current) return []
  const onRoute = new Set(onRouteTargets)
  return hexes
    .filter((h) => hexDistance(h, current) === 1 && !onRoute.has(h.id))
    .filter((h) => {
      const toPos = resolveStand(h)
      return canOfferNeighbor({
        fromHex: current,
        toHex: h,
        fromPos,
        toPos,
        path: [fromPos, toPos],
        ctx: barriers,
        hexAtPoint,
        size,
      })
    })
    .map((h) => ({
      toHexId: h.id,
      label: bearingLabel(current, h, size),
    }))
}

export function pointsAttr(pts) {
  return pts.map((p) => `${p.x},${p.y}`).join(' ')
}
