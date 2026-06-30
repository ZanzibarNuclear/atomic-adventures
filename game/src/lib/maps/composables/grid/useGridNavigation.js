import { roomLabel } from "../../../displayLabel.js";
import { canPassDoor, canBargeThroughDoor } from '../useDoors.js'
import {
  dirBetween,
  isStairLanding,
  roomLevel,
  spiralLandingsFor,
} from './useGridModel.js'
import { isRoomMapped, linkPassable } from './useGridVisibility.js'

function linkPassableOrBarge(link, doorState, areaId, building) {
  if (linkPassable(link, doorState, areaId, building)) return true
  if (link.kind !== 'door' || !link.door || !doorState) return false
  const door = building?.doorById?.[link.door]
  return canBargeThroughDoor(doorState, areaId, link.door, door)
}

function moveLabel(kind, dir, from, to) {
  if (to?.feature) {
    const name = roomLabel(to).toLowerCase() || "stairs";
    return `onto the ${name}`
  }
  if (from?.feature) {
    const short = roomLabel(to).split("/")[0].trim().toLowerCase();
    if (dir === 'same') return short ? `into the ${short}` : 'into the next room'
    if (to.id === 'kitchen') return 'up to the kitchen'
    if (to.id === 'hallway') return 'down to the hallway'
    if (to.id === 'large-bay') return 'down to the large bay'
    if (dir === 'up') return short ? `up to the ${short}` : 'up the stairs'
    if (dir === 'down') return short ? `down to the ${short}` : 'down the stairs'
    return short ? `into the ${short}` : 'into the next room'
  }
  if (kind === 'door') return 'through the door'
  if (kind === 'open') return 'across the open garage'
  const flight = kind === 'winding-stairs' ? 'the spiral stair' : 'the stairs'
  if (dir === 'up') return `up ${flight}`
  if (dir === 'down') return `down ${flight}`
  return `along ${flight}`
}

function standLevel(room, atLevel) {
  return roomLevel(room, atLevel)
}

export function moveKey(move) {
  if (move.toStandId) return `stand:${move.toStandId}`
  if (move.onSpiral) return `${move.toRoomId}:${move.dir}`
  if (move.toExteriorNode) return `ext:${move.toExteriorNode}`
  return move.toRoomId
}

export function movesFrom(
  building,
  roomId,
  atLevel = null,
  doorState = null,
  visibility = null,
  opts = {},
) {
  const { includeBarge = false } = opts
  const linkOk = includeBarge ? linkPassableOrBarge : linkPassable
  const out = []
  const from = building.roomById[roomId]
  if (!from) return out
  const fromLevel = standLevel(from, atLevel)
  const areaId = building.areaId

  function targetReachable(room, link) {
    if (!room || isStairLanding(room)) return true
    if (link.kind === 'door' && link.door) return true
    if (link.kind === 'stairs') return true
    return isRoomMapped(room, visibility)
  }

  if (isStairLanding(from)) {
    for (const link of building.links) {
      let otherId = null
      if (link.from === roomId) otherId = link.to
      else if (link.to === roomId) otherId = link.from
      if (!otherId) continue
      if (!linkOk(link, doorState, areaId, building)) continue
      const other = building.roomById[otherId]
      if (!other || isStairLanding(other)) continue
      if (!targetReachable(other, link)) continue
      const otherLevel = roomLevel(other)
      if (otherLevel !== fromLevel) continue
      const dir = dirBetween(building, { level: fromLevel }, { level: otherLevel })
      const kind = link.kind === 'stairs' ? 'open' : link.kind
      out.push({
        toRoomId: otherId,
        kind,
        dir,
        doorId: link.door ?? null,
        label: moveLabel(kind, dir, from, other),
        toName: roomLabel(other),
        toLevel: otherLevel,
      })
    }
    return out
  }

  for (const link of building.links) {
    let toId = null
    if (link.from === roomId) toId = link.to
    else if (link.to === roomId) toId = link.from
    if (!toId) continue
    if (!linkOk(link, doorState, areaId, building)) continue
    const to = building.roomById[toId]
    if (!to) continue
    if (!targetReachable(to, link)) continue
    let toLevel = roomLevel(to, isStairLanding(to) ? fromLevel : null)
    if (link.kind === 'stairs' && isStairLanding(to)) {
      const { low, high } = spiralLandingsFor(building, to)
      toLevel = fromLevel === low ? high : low
    }
    const dir = dirBetween(building, { level: fromLevel }, { level: toLevel })
    out.push({
      toRoomId: toId,
      kind: link.kind,
      dir,
      doorId: link.door ?? null,
      label: moveLabel(link.kind, dir, from, to),
      toName: roomLabel(to),
      toLevel,
    })
  }
  return out
}

export { spiralLandingsFor, moveLabel, standLevel, linkPassableOrBarge }
