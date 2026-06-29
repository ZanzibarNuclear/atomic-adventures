import { canPassDoor } from '../useDoors.js'
import {
  isStairLanding,
  linkedRoomIdsForDoor,
  primaryLevel,
  spiralStairEndpointRoom,
  stairExitRooms,
} from './useGridModel.js'

export function mapVisibilityCtx(
  discovered,
  revealed = [],
  building = null,
  doorState = null,
  areaId = null,
  builderView = false,
  currentRoom = null,
  exteriorNode = null,
) {
  return {
    discovered: discovered instanceof Set ? discovered : new Set(discovered),
    revealed: revealed instanceof Set ? revealed : new Set(revealed),
    building,
    doorState,
    areaId: areaId ?? building?.areaId ?? null,
    builderView,
    currentRoom: currentRoom ?? null,
    exteriorNode: exteriorNode ?? null,
  }
}

export function isOutsideBuilding(ctx) {
  return !!ctx?.exteriorNode && !ctx?.currentRoom
}

export function fixtureRevealKey(fixtureId) {
  return `fixture:${fixtureId}`
}

export function doorRevealKey(doorId) {
  return `door:${doorId}`
}

export function applyRevealDoorsForRoom(building, revealedSet, roomId) {
  if (!building || !roomId) return
  for (const link of building.links ?? []) {
    if (link.kind === 'door' && link.door && (link.from === roomId || link.to === roomId)) {
      revealedSet.add(doorRevealKey(link.door))
    }
  }
  for (const door of building.doors ?? []) {
    if (door.id && door.room === roomId) revealedSet.add(doorRevealKey(door.id))
  }
}

function isDoorPeekOpen(doorId, ctx) {
  if (!doorId || !ctx?.doorState || !ctx?.areaId) return false
  return canPassDoor(ctx.doorState, ctx.areaId, doorId)
}

function canPeekThroughDoor(doorId, ctx) {
  if (!isDoorPeekOpen(doorId, ctx)) return false
  const door = ctx?.building?.doorById?.[doorId]
  if (door?.showWhenRevealed) {
    const room = ctx.building?.roomById?.[door.showWhenRevealed]
    if (!room || !isRoomMapped(room, ctx)) return false
  }
  return true
}

function linkPassable(link, doorState, areaId, building) {
  if (link.kind !== 'door' || !link.door) return true
  if (!doorState) return false
  const door = building?.doorById?.[link.door]
  return canPassDoor(doorState, areaId, link.door, door)
}

function passableNeighborIds(building, roomId, doorState, areaId) {
  const out = []
  for (const link of building.links ?? []) {
    let otherId = null
    if (link.from === roomId) otherId = link.to
    else if (link.to === roomId) otherId = link.from
    else continue
    if (!linkPassable(link, doorState, areaId, building)) continue
    out.push(otherId)
  }
  return out
}

function isAdjacentToDiscovered(roomId, ctx) {
  if (!ctx?.building || !ctx.discovered?.size) return false
  const target = ctx.building.roomById?.[roomId]
  const targetLevel = primaryLevel(target)
  for (const discoveredId of ctx.discovered) {
    const from = ctx.building.roomById?.[discoveredId]
    if (primaryLevel(from) !== targetLevel) continue
    const neighbors = passableNeighborIds(ctx.building, discoveredId, ctx.doorState, ctx.areaId)
    if (neighbors.includes(roomId)) return true
  }
  return false
}

function roomPeekableThroughOpenDoor(roomId, ctx) {
  if (!ctx?.building || !ctx.doorState) return false
  for (const door of ctx.building.doors ?? []) {
    if (!door.id) continue
    if (!linkedRoomIdsForDoor(ctx.building, door).includes(roomId)) continue
    if (canPeekThroughDoor(door.id, ctx)) return true
  }
  return false
}

export function isRoomMapped(room, ctx) {
  if (ctx?.builderView) return true
  if (!room || room.feature) return true
  if (!ctx) return false
  if (ctx.discovered.has(room.id) || ctx.revealed.has(room.id)) return true
  if (room.mirror && ctx.discovered.has(room.mirror)) return true
  if (room.revealWhenDoor && canPeekThroughDoor(room.revealWhenDoor, ctx)) return true
  if (roomPeekableThroughOpenDoor(room.id, ctx)) return true
  return isAdjacentToDiscovered(room.id, ctx)
}

export function isRoomFogged(room, ctx) {
  if (ctx?.builderView) return false
  if (!isRoomMapped(room, ctx)) return false
  if (room.mirror && ctx?.discovered.has(room.mirror)) return false
  return !ctx?.discovered.has(room.id)
}

function stairEndDiscovered(stairRoom, ctx) {
  if (!stairRoom?.feature || !ctx?.discovered?.size) return false
  const { downRoomId, upRoomId } = stairExitRooms(ctx.building, stairRoom.id)
  return (
    (!!downRoomId && ctx.discovered.has(downRoomId)) ||
    (!!upRoomId && ctx.discovered.has(upRoomId))
  )
}

export function isDoorMapped(door, ctx) {
  if (ctx?.builderView) return true
  if (!door) return true
  if (isOutsideBuilding(ctx)) {
    if (ctx?.building?.exitByDoorId?.[door.id]) return true
    if (ctx?.building?.exterior?.entryByDoorId?.[door.id]) return true
  }
  if (door.showWhenDiscovered && !ctx?.discovered.has(door.showWhenDiscovered)) return false
  if (door.showWhenRoom) {
    const linkedIds = linkedRoomIdsForDoor(ctx.building, door)
    const linkedDiscovered = linkedIds.some((id) => ctx?.discovered.has(id))
    if (!ctx?.discovered.has(door.showWhenRoom) && !linkedDiscovered) return false
  }
  if (door.showWhenRevealed) {
    const room = ctx?.building?.roomById?.[door.showWhenRevealed]
    if (!room || !isRoomMapped(room, ctx)) return false
  }
  if (ctx?.revealed.has(doorRevealKey(door.id))) return true
  const linked = linkedRoomIdsForDoor(ctx.building, door)
    .map((id) => ctx.building?.roomById?.[id])
    .filter(Boolean)
  const onStairLanding = linked.some((r) => isStairLanding(r) && ctx.discovered.has(r.id))
  const onStairRun =
    !!ctx.currentRoom &&
    linked.some((r) => isStairLanding(r) && r.id === ctx.currentRoom)
  const standingInLinkedRoom =
    !!ctx.currentRoom &&
    linked.some((r) => r.id === ctx.currentRoom && ctx.discovered.has(r.id))
  const stairEndKnown = linked.some(
    (r) => isStairLanding(r) && isRoomMapped(r, ctx) && stairEndDiscovered(r, ctx),
  )
  const spiralEnd = spiralStairEndpointRoom(door, ctx.building)
  if (spiralEnd && !ctx.discovered.has(spiralEnd.id) && !onStairRun) {
    return false
  }
  for (const room of linked) {
    if (isStairLanding(room)) {
      if (!isRoomMapped(room, ctx)) return false
      continue
    }
    if (!isRoomMapped(room, ctx)) {
      if (onStairLanding || onStairRun || standingInLinkedRoom || stairEndKnown) continue
      return false
    }
  }
  return true
}

export function isFixtureMapped(fixture, ctx) {
  if (ctx?.builderView) return true
  if (fixture.visualOnly) return true
  if (!fixture.revealWhenDoor) {
    const ids = fixture.connects ?? []
    return !ctx || ids.some((id) => ctx.discovered.has(id))
  }
  if (!ctx) return false
  const key = fixtureRevealKey(fixture.id)
  if (ctx.revealed.has(key)) return true
  if (canPeekThroughDoor(fixture.revealWhenDoor, ctx)) return true
  return (fixture.connects ?? []).some((id) => ctx.discovered.has(id))
}

export function isFixtureFogged(fixture, ctx) {
  if (ctx?.builderView) return false
  if (fixture.visualOnly) return false
  if (!isFixtureMapped(fixture, ctx)) return false
  if (!fixture.revealWhenDoor) {
    const ids = fixture.connects ?? []
    return !ids.some((id) => ctx?.discovered.has(id))
  }
  const target = fixture.revealRoom
  if (target) {
    const room = ctx?.building?.roomById?.[target]
    return !!room && isRoomMapped(room, ctx) && !ctx.discovered.has(target)
  }
  const key = fixtureRevealKey(fixture.id)
  return (ctx.revealed.has(key) || canPeekThroughDoor(fixture.revealWhenDoor, ctx)) && !ctx.discovered.has(key)
}

export function applyRevealForDoor(building, revealedSet, doorId) {
  revealedSet.add(doorRevealKey(doorId))
  const door = building.doorById?.[doorId]
  for (const room of building.rooms) {
    if (room.revealWhenDoor === doorId) revealedSet.add(room.id)
  }
  for (const fixture of building.fixtures ?? []) {
    if (fixture.revealWhenDoor === doorId) revealedSet.add(fixtureRevealKey(fixture.id))
  }
  for (const link of building.links ?? []) {
    if (link.kind === 'door' && link.door === doorId) {
      revealedSet.add(link.from)
      revealedSet.add(link.to)
    }
  }
  if (door) {
    for (const id of linkedRoomIdsForDoor(building, door)) {
      revealedSet.add(id)
    }
  }
}

export function isDestinationNamed(roomId, ctx) {
  if (ctx?.builderView) return true
  if (!ctx) return false
  if (ctx.discovered.has(roomId)) return true
  if (ctx.revealed.has(roomId)) return true
  const room = ctx.building?.roomById?.[roomId]
  return !!room && isRoomMapped(room, ctx)
}

export { linkPassable, passableNeighborIds }
