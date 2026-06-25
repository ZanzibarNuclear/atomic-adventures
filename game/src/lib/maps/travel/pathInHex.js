import { BARRIER_STAND_INSET } from "../composables/useBarrierStand.js";
import { hexCenterStand } from "../composables/useAvatarStand.js";
import { segmentIntersection } from "../geometry/segments.js";
import { barrierList } from "./barrierContext.js";
import {
  hexPolygon,
  pointInHexPolygon,
  segmentInsideHex,
} from "./hexPolygon.js";

const BARRIER_JUNCTION_CACHE = new WeakMap();

function samePoint(a, b) {
  return !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
}

function interpolate(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

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

function uniquePush(points, point) {
  if (!point) return;
  if (points.some((p) => samePoint(p, point))) return;
  points.push(point);
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

function segmentClearsBarrierJunctions(a, b, ctx, minClearance) {
  for (const junction of barrierJunctions(ctx)) {
    if (pointToSegmentDistance(junction, { a, b }) < minClearance) {
      return false;
    }
  }
  return true;
}

/**
 * Barrier-bounded walk inside one hex from `from` to `to` without crossing
 * blocked path segments. The caller owns the path-clear predicate so this
 * module stays independent of higher-level opening and move semantics.
 */
export function pathInHex(hex, from, to, ctx, size, pathClear) {
  if (!hex || !from || !to || !ctx || size == null || !pathClear) return null;
  if (!pointInHexPolygon(from, hex, size) || !pointInHexPolygon(to, hex, size)) {
    return null;
  }
  if (segmentInsideHex(from, to, hex, size, interpolate) && pathClear([from, to], ctx)) {
    return [from, to];
  }

  const corners = hexPolygon(hex, size);
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const step = Math.max(6, size / 4);
  const maxEdge = step * 1.55;
  const nodes = [];
  uniquePush(nodes, from);
  uniquePush(nodes, to);

  const center = hexCenterStand(hex, size);
  uniquePush(nodes, center);
  for (const corner of corners) {
    uniquePush(nodes, interpolate(corner, center, 0.12));
  }
  for (let x = minX; x <= maxX + 0.01; x += step) {
    for (let y = minY; y <= maxY + 0.01; y += step) {
      const point = { x, y };
      if (pointInHexPolygon(point, hex, size)) uniquePush(nodes, point);
    }
  }

  const startIdx = 0;
  const targetIdx = 1;
  const queue = [startIdx];
  const prev = new Map([[startIdx, null]]);

  while (queue.length) {
    const idx = queue.shift();
    if (idx === targetIdx) break;
    const current = nodes[idx];
    for (let nextIdx = 0; nextIdx < nodes.length; nextIdx++) {
      if (prev.has(nextIdx) || nextIdx === idx) continue;
      const next = nodes[nextIdx];
      const dist = pointDistance(current, next);
      if (nextIdx !== targetIdx && dist > maxEdge) continue;
      if (nextIdx === targetIdx && dist > maxEdge && idx !== startIdx) continue;
      if (!segmentInsideHex(current, next, hex, size, interpolate)) continue;
      if (
        !segmentClearsBarrierJunctions(
          current,
          next,
          ctx,
          BARRIER_STAND_INSET.fence * 2.5,
        )
      ) {
        continue;
      }
      if (!pathClear([current, next], ctx)) continue;
      prev.set(nextIdx, idx);
      queue.push(nextIdx);
    }
  }

  if (!prev.has(targetIdx)) return null;
  const path = [];
  for (let idx = targetIdx; idx != null; idx = prev.get(idx)) {
    path.unshift(nodes[idx]);
  }
  return path;
}
