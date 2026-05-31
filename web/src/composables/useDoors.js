// Door state: open/closed, locked/unlocked, and lockBroken (cannot re-lock).
// YAML holds initial state; runtime lives in a serializable map keyed by area:door.

export function doorStateKey(areaId, doorId) {
  return `${areaId}:${doorId}`
}

export function normalizeDoorInitial(initial = {}) {
  const closed = initial.closed ?? (initial.open != null ? !initial.open : true)
  const lockBroken = initial.lockBroken ?? false
  let locked = initial.locked ?? false
  if (lockBroken) locked = false
  return {
    open: initial.open ?? !closed,
    locked,
    lockBroken,
  }
}

export function buildInitialDoorState(areaId, building) {
  const state = {}
  for (const door of building.doors ?? []) {
    if (!door.id) continue
    state[doorStateKey(areaId, door.id)] = normalizeDoorInitial(door.initial)
  }
  return state
}

export function getDoorState(doorState, areaId, doorId) {
  return doorState[doorStateKey(areaId, doorId)] ?? null
}

/** Walk-through requires the door to be open. */
export function canPassDoor(doorState, areaId, doorId) {
  if (!doorId) return true
  const s = getDoorState(doorState, areaId, doorId)
  if (!s) return false
  return s.open === true
}

export function canOpenDoor(doorState, areaId, doorId) {
  const s = getDoorState(doorState, areaId, doorId)
  return s && !s.open && !s.locked
}

export function canCloseDoor(doorState, areaId, doorId) {
  const s = getDoorState(doorState, areaId, doorId)
  return s && s.open && !s.locked
}

export function canUnlockDoor(doorState, areaId, doorId) {
  const s = getDoorState(doorState, areaId, doorId)
  return s && s.locked && !s.lockBroken
}

export function canBreakLock(doorState, areaId, doorId) {
  const s = getDoorState(doorState, areaId, doorId)
  return s && s.locked && !s.lockBroken
}

export function canLockDoor(doorState, areaId, doorId) {
  const s = getDoorState(doorState, areaId, doorId)
  return s && !s.lockBroken && !s.open && !s.locked
}

export function canToggleLock(doorState, areaId, doorId) {
  const s = getDoorState(doorState, areaId, doorId)
  if (!s || s.lockBroken || s.open) return false
  return true
}

export function toggleDoorLock(doorState, areaId, doorId) {
  const s = getDoorState(doorState, areaId, doorId)
  if (!s || s.lockBroken || s.open) return false
  if (s.locked) {
    s.locked = false
  } else {
    s.locked = true
  }
  return true
}

export function setDoorOpen(doorState, areaId, doorId, open) {
  const s = getDoorState(doorState, areaId, doorId)
  if (!s || s.locked) return false
  s.open = open
  return true
}

export function unlockDoor(doorState, areaId, doorId) {
  const s = getDoorState(doorState, areaId, doorId)
  if (!s || s.lockBroken) return false
  s.locked = false
  return true
}

export function breakLock(doorState, areaId, doorId) {
  const s = getDoorState(doorState, areaId, doorId)
  if (!s || s.lockBroken || !s.locked) return false
  s.lockBroken = true
  s.locked = false
  return true
}

/** Locking is only possible while the lock hardware is intact. */
export function lockDoor(doorState, areaId, doorId) {
  const s = getDoorState(doorState, areaId, doorId)
  if (!s || s.lockBroken || s.open) return false
  s.locked = true
  return true
}

/** Doors the player can interact with from their current room. */
export function doorsFromRoom(building, roomId) {
  const seen = new Set()
  const out = []
  for (const link of building.links ?? []) {
    if (link.kind !== 'door' || !link.door) continue
    if (link.from !== roomId && link.to !== roomId) continue
    if (seen.has(link.door)) continue
    seen.add(link.door)
    const otherId = link.from === roomId ? link.to : link.from
    out.push({
      doorId: link.door,
      toRoomId: otherId,
      toName: building.roomById[otherId]?.name ?? otherId,
    })
  }
  for (const door of building.doors ?? []) {
    if (!door.id || seen.has(door.id)) continue
    if (door.room === roomId) {
      seen.add(door.id)
      out.push({ doorId: door.id, toRoomId: null, toName: null })
    }
  }
  return out
}

export function doorLabel(building, doorId, toName) {
  const door = building.doorById?.[doorId]
  if (door?.label) return door.label
  if (door?.kind === 'roll') {
    const room = building.roomById[door.room]
    return `${room?.name ?? door.room} roll-up`
  }
  if (toName) return `Door to ${toName}`
  return doorId.replace(/-/g, ' ')
}

export function doorStatusText(state) {
  if (!state) return 'unknown'
  if (state.open) return 'open'
  if (state.locked) return 'locked'
  if (state.lockBroken) return 'closed · lock broken'
  return 'closed'
}
