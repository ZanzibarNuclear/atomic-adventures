/**
 * Known-area multi-hop outdoor travel (pure planning).
 * @see docs/contracts/hex-crawling.md — Discovery travel vs known-area travel
 */

import { hexDistance, neighborsOf } from "./useHexGeometry.js";
import { resolveNeighborStand } from "./useAvatarStand.js";
import { resolveMove } from "./useTravelBarriers.js";
import { buildMovePath, routeLegBetween } from "./useRoutes.js";

/**
 * @param {object} opts
 * @param {string} opts.fromHexId
 * @param {{ x: number, y: number }} opts.fromStand
 * @param {string} opts.toHexId
 * @param {Set<string>|string[]} opts.discovered
 * @param {Record<string, object>} opts.hexById — hex id → { id, q, r, ... }
 * @param {number} opts.size
 * @param {object} opts.travelCtx — barrier/opening context
 * @param {(point: {x,y}, preferId?: string) => string|null} opts.hexAtPoint
 * @param {object[]} [opts.routeModels]
 * @returns {{ steps: { hexId: string, stand: {x,y}, path: object[] }[], pathPoints: {x,y}[] } | null}
 */
export function planKnownHexPath({
  fromHexId,
  fromStand,
  toHexId,
  discovered,
  hexById,
  size,
  travelCtx,
  hexAtPoint,
  routeModels = [],
}) {
  if (!fromHexId || !toHexId || !hexById?.[fromHexId] || !hexById?.[toHexId]) {
    return null;
  }
  if (fromHexId === toHexId) {
    return { steps: [], pathPoints: [fromStand] };
  }

  const known = discovered instanceof Set ? discovered : new Set(discovered ?? []);
  if (!known.has(fromHexId) || !known.has(toHexId)) return null;

  // Axial key → hex id for neighbor lookup
  const idByAxial = new Map();
  for (const hex of Object.values(hexById)) {
    if (hex?.id == null || !Number.isFinite(hex.q) || !Number.isFinite(hex.r)) continue;
    idByAxial.set(`${hex.q},${hex.r}`, hex.id);
  }

  function neighborIds(hexId) {
    const hex = hexById[hexId];
    if (!hex) return [];
    return neighborsOf(hex)
      .map((n) => idByAxial.get(`${n.q},${n.r}`))
      .filter((id) => id && known.has(id));
  }

  function tryStep(fromId, stand, toId) {
    const fromHex = hexById[fromId];
    const toHex = hexById[toId];
    if (!fromHex || !toHex || hexDistance(fromHex, toHex) !== 1) return null;
    const toPos = resolveNeighborStand(fromHex, toHex, stand, size, travelCtx);
    const routeLeg = routeLegBetween(fromId, toId, routeModels);
    const path = buildMovePath(stand, fromHex, toHex, toPos, routeLeg, routeModels);
    // Known-area: openings allowed when available (discovered / open gates).
    const result = resolveMove({
      fromHex,
      toHex,
      fromPos: stand,
      toPos,
      path,
      ctx: travelCtx,
      hexAtPoint,
      size,
      allowOpenings: true,
    });
    if (result.activeHexId !== toHex.id) return null;
    return {
      hexId: toHex.id,
      stand: result.stand,
      path: result.path?.length ? result.path : path,
    };
  }

  // BFS over discovered hexes; state key = hexId (stand approximated by arrival stand).
  const queue = [{ hexId: fromHexId, stand: fromStand }];
  const prev = new Map(); // hexId → { fromHexId, step }
  prev.set(fromHexId, null);
  let head = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    if (cur.hexId === toHexId) break;
    for (const nextId of neighborIds(cur.hexId)) {
      if (prev.has(nextId)) continue;
      const step = tryStep(cur.hexId, cur.stand, nextId);
      if (!step) continue;
      prev.set(nextId, { fromHexId: cur.hexId, step });
      queue.push({ hexId: nextId, stand: step.stand });
    }
  }

  if (!prev.has(toHexId) || prev.get(toHexId) === null && fromHexId !== toHexId) {
    if (fromHexId !== toHexId && !prev.get(toHexId)) return null;
  }
  if (!prev.has(toHexId)) return null;

  // Reconstruct steps
  const steps = [];
  let walk = toHexId;
  while (walk !== fromHexId) {
    const rec = prev.get(walk);
    if (!rec) return null;
    steps.push(rec.step);
    walk = rec.fromHexId;
  }
  steps.reverse();

  const pathPoints = [fromStand];
  for (const step of steps) {
    const pts = step.path ?? [step.stand];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const last = pathPoints[pathPoints.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) pathPoints.push(p);
    }
  }

  return { steps, pathPoints };
}

/** Whether known-area multi-hop is allowed for this target (not same hex; discovered). */
export function canPlanKnownHexPath(opts) {
  return planKnownHexPath(opts) != null;
}
