/**
 * Known-area multi-hop indoor travel (pure planning).
 * @see docs/contracts/indoor-stands.md — Discovery travel vs known-area travel
 */

import { movesFrom } from "./useGrid.js";
import { canTraverseDoorOnPath } from "./useDoors.js";

/**
 * BFS over known rooms using door/stair links.
 * Closed unlocked doors are pathable (manners applied at execution time).
 * Locked doors block free travel (no ghost walk-through).
 *
 * @param {object} opts
 * @param {object} opts.building — buildBuilding() model
 * @param {string} opts.fromRoomId
 * @param {string} opts.toRoomId
 * @param {Set<string>|string[]} opts.discovered
 * @param {object} opts.doorState
 * @param {object|null} [opts.visibility]
 * @param {string|null} [opts.atLevel]
 * @returns {object[]|null} ordered move edges, or null
 */
export function planKnownRoomPath({
  building,
  fromRoomId,
  toRoomId,
  discovered,
  doorState,
  visibility = null,
  atLevel = null,
}) {
  if (!building || !fromRoomId || !toRoomId) return null;
  if (fromRoomId === toRoomId) return [];

  const known =
    discovered instanceof Set ? discovered : new Set(discovered ?? []);
  if (!known.has(toRoomId)) return null;

  const areaId = building.areaId;
  const queue = [fromRoomId];
  const prev = new Map([[fromRoomId, null]]);
  let head = 0;

  while (head < queue.length) {
    const roomId = queue[head++];
    if (roomId === toRoomId) break;

    const room = building.roomById?.[roomId];
    const level = room?.level ?? atLevel;
    const edges = movesFrom(building, roomId, level, doorState, visibility, {
      includeBarge: true,
    });

    for (const edge of edges) {
      if (edge.onSpiral || !edge.toRoomId || prev.has(edge.toRoomId)) continue;
      if (!known.has(edge.toRoomId)) continue;
      if (edge.doorId) {
        const door = building.doorById?.[edge.doorId];
        if (
          !canTraverseDoorOnPath(doorState, areaId, edge.doorId, door)
        ) {
          continue;
        }
      }
      prev.set(edge.toRoomId, { from: roomId, move: edge });
      queue.push(edge.toRoomId);
    }
  }

  if (!prev.has(toRoomId) || prev.get(toRoomId) === null) return null;

  const path = [];
  let walk = toRoomId;
  while (walk !== fromRoomId) {
    const rec = prev.get(walk);
    if (!rec) return null;
    path.push(rec.move);
    walk = rec.from;
  }
  path.reverse();
  return path;
}

export function canPlanKnownRoomPath(opts) {
  const path = planKnownRoomPath(opts);
  return path != null && (path.length > 0 || opts.fromRoomId === opts.toRoomId);
}
