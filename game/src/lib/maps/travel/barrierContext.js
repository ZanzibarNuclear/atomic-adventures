import { BARRIER_STAND_INSET } from "../composables/useBarrierStand.js";
import { segmentIntersection, sideOfLine } from "../geometry/segments.js";

/** Which point-feature kinds allow crossing each barrier kind. */
export const BARRIER_OPENINGS = {
  fence: ["gate", "hole"],
  stream: ["bridge", "ford"],
  /** Larger watercourses; same openings as stream for now. */
  river: ["bridge", "ford"],
  cliff: ["stair"],
  ravine: ["bridge"],
};

export const BARRIER_KINDS = Object.keys(BARRIER_OPENINGS);

/** Watercourse barrier kinds (share bridge/ford openings and bank geometry). */
export const WATER_BARRIER_KINDS = new Set(["stream", "river"]);

export function isWaterBarrier(kind) {
  return WATER_BARRIER_KINDS.has(kind);
}

/** Point features — not drawable / routable polylines. */
export const BARRIER_OPENING_KINDS = new Set(
  Object.values(BARRIER_OPENINGS).flat(),
);

/** All barrier polylines from feature models. */
export function barrierSegments(featureModels) {
  const segs = [];
  for (const model of featureModels) {
    if (!BARRIER_KINDS.includes(model.kind)) continue;
    for (let i = 0; i < model.points.length - 1; i++) {
      segs.push({ a: model.points[i], b: model.points[i + 1], kind: model.kind });
    }
  }
  return segs;
}

export function fenceSegments(featureModels) {
  return barrierSegments(featureModels).filter((segment) => segment.kind === "fence");
}

/** Stream + river segments (any watercourse barrier). */
export function riverSegments(featureModels) {
  return barrierSegments(featureModels).filter((segment) => isWaterBarrier(segment.kind));
}

export function barrierList(ctx) {
  return ctx.barriers ?? [];
}

const PATH_ORIGIN_EPS = 0.02;
const BARRIER_JUNCTION_CACHE = new WeakMap();

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function closestPointOnSegment(p, seg) {
  const vx = seg.b.x - seg.a.x;
  const vy = seg.b.y - seg.a.y;
  const wx = p.x - seg.a.x;
  const wy = p.y - seg.a.y;
  const denom = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / denom));
  return { x: seg.a.x + vx * t, y: seg.a.y + vy * t };
}

function pointToSegmentDistance(p, seg) {
  return pointDistance(p, closestPointOnSegment(p, seg));
}

function samePoint(a, b) {
  return !!a && !!b && pointDistance(a, b) < 1e-6;
}

function uniquePush(points, point) {
  if (!point) return;
  if (points.some((p) => samePoint(p, point))) return;
  points.push(point);
}

/**
 * True when walk segment AB crosses barrier segment CD (endpoints on opposite
 * sides). Ignores grazing / parallel walks that stay on one side of the line.
 */
export function pathCrossesBarrier(a, b, c, d) {
  const sa = sideOfLine(a, c, d);
  const sb = sideOfLine(b, c, d);
  const eps = 1e-3;
  if (Math.abs(sa) <= eps && Math.abs(sb) <= eps) return false;
  if (Math.abs(sa) <= eps || Math.abs(sb) <= eps) {
    return segmentIntersection(a, b, c, d) != null;
  }
  return sa * sb < 0;
}

/** True when chord AB crosses any segment of `kind`. */
export function chordCrossesBarrierKind(fromPos, toPos, kind, ctx) {
  for (const seg of ctx.barriers ?? []) {
    if (seg.kind !== kind) continue;
    if (pathCrossesBarrier(fromPos, toPos, seg.a, seg.b)) return true;
  }
  return false;
}

export function barrierJunctions(ctx) {
  const barriers = barrierList(ctx);
  const cached = BARRIER_JUNCTION_CACHE.get(barriers);
  if (cached) return cached;
  const junctions = [];
  for (let i = 0; i < barriers.length; i++) {
    const seg = barriers[i];
    for (let j = i + 1; j < barriers.length; j++) {
      const other = barriers[j];
      const intersection = segmentIntersection(seg.a, seg.b, other.a, other.b);
      if (intersection) {
        uniquePush(junctions, { x: intersection.x, y: intersection.y });
      }
    }
    for (const endpoint of [seg.a, seg.b]) {
      const connects = barriers.some((other) => {
        if (other === seg) return false;
        const clearance =
          (BARRIER_STAND_INSET[seg.kind] ?? BARRIER_STAND_INSET.fence) +
          (BARRIER_STAND_INSET[other.kind] ?? BARRIER_STAND_INSET.fence);
        return pointToSegmentDistance(endpoint, other) <= clearance;
      });
      if (connects) uniquePush(junctions, endpoint);
    }
  }
  BARRIER_JUNCTION_CACHE.set(barriers, junctions);
  return junctions;
}

function nearBarrierJunctionHit(a, b, ctx) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const denom = vx * vx + vy * vy || 1;
  for (const junction of barrierJunctions(ctx)) {
    const t = Math.max(
      0,
      Math.min(
        1,
        ((junction.x - a.x) * vx + (junction.y - a.y) * vy) / denom,
      ),
    );
    if (t < PATH_ORIGIN_EPS) continue;
    const point = { x: a.x + vx * t, y: a.y + vy * t };
    if (pointDistance(point, junction) >= 3) continue;
    const connected = barrierList(ctx).filter(
      (seg) => pointToSegmentDistance(junction, seg) < 1,
    );
    const seg = connected[0];
    if (!seg) continue;
    return { ...point, t, kind: seg.kind, a: seg.a, b: seg.b };
  }
  return null;
}

function closedBarrierCtx(ctx) {
  return ctx ? { ...ctx, openings: [] } : ctx;
}

/** Context for adjacent hex travel: barriers block; openings do not apply. */
export function interHexTravelCtx(ctx) {
  if (ctx?.allowOpenings) return ctx;
  return closedBarrierCtx(ctx);
}

function openingMatchesBarrierKind(opening, kind) {
  return BARRIER_OPENINGS[kind]?.includes(opening.kind) ?? false;
}

function hitCoveredByOpening(hit, seg, ctx) {
  return (ctx.openings ?? []).some((opening) =>
    (!ctx.allowOpeningHexId || opening.hex === ctx.allowOpeningHexId) &&
    openingMatchesBarrierKind(opening, seg.kind) &&
    pointDistance(hit, opening) <= Number(opening.r ?? 0) + 1,
  );
}

/** First barrier hit along a polyline path; null when none. */
export function firstBlockedOnPath(path, ctx) {
  const travelCtx = interHexTravelCtx(ctx);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const junctionHit = nearBarrierJunctionHit(a, b, travelCtx);
    if (junctionHit) return { ...junctionHit, segIndex: i };
    for (const seg of barrierList(travelCtx)) {
      const cross = segmentIntersection(a, b, seg.a, seg.b);
      if (!cross || cross.t < PATH_ORIGIN_EPS) continue;
      if (!pathCrossesBarrier(a, b, seg.a, seg.b)) continue;
      if (hitCoveredByOpening(cross, seg, travelCtx)) continue;
      return { ...cross, kind: seg.kind, segIndex: i, a: seg.a, b: seg.b };
    }
  }
  return null;
}

/** First barrier hit along `path` whose intersection lies in `hexId`. */
export function firstBlockedOnPathInHex(path, ctx, hexId, hexAtPoint) {
  const travelCtx = interHexTravelCtx(ctx);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const junctionHit = nearBarrierJunctionHit(a, b, travelCtx);
    if (
      junctionHit &&
      hexAtPoint({ x: junctionHit.x, y: junctionHit.y }, hexId) === hexId
    ) {
      return { ...junctionHit, segIndex: i };
    }
    for (const seg of barrierList(travelCtx)) {
      const cross = segmentIntersection(a, b, seg.a, seg.b);
      if (!cross || cross.t < PATH_ORIGIN_EPS) continue;
      if (!pathCrossesBarrier(a, b, seg.a, seg.b)) continue;
      if (hitCoveredByOpening(cross, seg, travelCtx)) continue;
      if (hexAtPoint({ x: cross.x, y: cross.y }, hexId) === hexId) {
        return { ...cross, kind: seg.kind, segIndex: i, a: seg.a, b: seg.b };
      }
    }
  }
  return null;
}
