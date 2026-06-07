// Door state: open/closed, locked/unlocked, and lockBroken (cannot re-lock).
// YAML holds initial state; runtime lives in a serializable map keyed by area:door.
//
// Lock rules (YAML on each door):
//   lock.key          — physical key id; required from the non-free side
//   lock.freeFrom     — room id where lock/unlock needs no key (interior thumb turn)
//   lock.kind: enabler — roll-ups: unlock when any enabler is active (power, manual)
//   lock.enablers     — [power, manual] for enabler locks

import { hasItem } from './useInventory.js'

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

export function linkedRoomIdsForDoor(building, door) {
  if (!door) return []
  if (door.room) return [door.room]
  const ids = new Set()
  for (const link of building.links ?? []) {
    if (link.kind === 'door' && link.door === door.id) {
      ids.add(link.from)
      ids.add(link.to)
    }
  }
  return [...ids]
}

export function doorLockConfig(door) {
  return door?.lock ?? null
}

export function isEnablerLock(door) {
  const lock = doorLockConfig(door)
  if (!lock) return door?.kind === 'roll'
  return lock.kind === 'enabler' || !!lock.enablers?.length
}

export function lockFreeFromRoom(door) {
  return doorLockConfig(door)?.freeFrom ?? door?.lockFrom ?? null
}

export function requiredKeyId(door) {
  return doorLockConfig(door)?.key ?? door?.key ?? null
}

/** Roll-up / enabler: station power restores the motorized opener. */
export function isPowerEnablerActive(facilityState) {
  return facilityState?.powerOn === true
}

/** Roll-up / enabler: manual release disengages the chain hoist on that door. */
export function isManualEnablerActive(doorId, facilityState) {
  return facilityState?.manualMode?.[doorId] === true
}

export function activeEnablersForDoor(doorId, door, facilityState) {
  const lock = doorLockConfig(door)
  const kinds = lock?.enablers ?? (door?.kind === 'roll' ? ['power', 'manual'] : [])
  const active = []
  if (kinds.includes('power') && isPowerEnablerActive(facilityState)) active.push('power')
  if (kinds.includes('manual') && isManualEnablerActive(doorId, facilityState)) active.push('manual')
  return active
}

export function canUnlockViaEnablers(doorId, door, facilityState) {
  if (!isEnablerLock(door)) return false
  return activeEnablersForDoor(doorId, door, facilityState).length > 0
}

/**
 * Physical-key doors: freeFrom room toggles without a key; other sides need the key.
 * Enabler doors: unlock only when power or manual mode is active.
 */
export function canToggleLockFromRoom(
  doorState,
  building,
  areaId,
  doorId,
  playerRoomId,
  inventory,
  facilityState,
) {
  const door = building?.doorById?.[doorId]
  const s = getDoorState(doorState, areaId, doorId)
  if (!s || s.lockBroken || s.open) {
    return { ok: false, reason: s?.open ? 'open' : 'blocked' }
  }

  if (isEnablerLock(door)) {
    if (s.locked && !canUnlockViaEnablers(doorId, door, facilityState)) {
      return { ok: false, reason: 'need-enabler', doorId }
    }
    return { ok: true }
  }

  const freeFrom = lockFreeFromRoom(door)
  if (freeFrom && playerRoomId === freeFrom) return { ok: true }

  const keyId = requiredKeyId(door)
  if (!keyId) return { ok: true }
  if (hasItem(inventory, keyId)) return { ok: true }

  return { ok: false, reason: 'need-key', keyId }
}

export function canToggleLock(
  doorState,
  areaId,
  doorId,
  building = null,
  playerRoomId = null,
  inventory = null,
  facilityState = null,
) {
  if (!building || playerRoomId == null) {
    const s = getDoorState(doorState, areaId, doorId)
    return !!(s && !s.lockBroken && !s.open)
  }
  return canToggleLockFromRoom(
    doorState,
    building,
    areaId,
    doorId,
    playerRoomId,
    inventory ?? new Set(),
    facilityState ?? {},
  ).ok
}

export function toggleDoorLock(
  doorState,
  areaId,
  doorId,
  building = null,
  playerRoomId = null,
  inventory = null,
  facilityState = null,
) {
  const door = building?.doorById?.[doorId]
  const s = getDoorState(doorState, areaId, doorId)
  if (!s || s.lockBroken || s.open) return false

  if (building && playerRoomId != null) {
    const check = canToggleLockFromRoom(
      doorState,
      building,
      areaId,
      doorId,
      playerRoomId,
      inventory ?? new Set(),
      facilityState ?? {},
    )
    if (!check.ok) return false
  }

  if (isEnablerLock(door) && s.locked && facilityState) {
    if (!canUnlockViaEnablers(doorId, door, facilityState)) return false
  }

  s.locked = !s.locked
  return true
}

/** When power or manual mode comes on, roll-up motor locks release automatically. */
export function applyEnablerAutoUnlock(doorState, building, areaId, facilityState) {
  if (!building || !facilityState) return 0
  let n = 0
  for (const door of building.doors ?? []) {
    if (!door.id || !isEnablerLock(door)) continue
    const s = getDoorState(doorState, areaId, door.id)
    if (!s?.locked || s.lockBroken) continue
    if (!canUnlockViaEnablers(door.id, door, facilityState)) continue
    s.locked = false
    n++
  }
  return n
}

export function setDoorOpen(doorState, areaId, doorId, open) {
  const s = getDoorState(doorState, areaId, doorId)
  if (!s || s.locked) return false
  s.open = open
  return true
}

/** Builder / debug: set every door open or closed (ignores locks). */
export function setAllDoorsOpen(doorState, areaId, building, open) {
  let n = 0
  for (const door of building.doors ?? []) {
    if (!door.id) continue
    const s = getDoorState(doorState, areaId, door.id)
    if (!s) continue
    s.open = open
    n++
  }
  return n
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

export function doorStatusText(state, door = null, facilityState = null) {
  if (!state) return 'unknown'
  if (state.open) return 'open'
  if (state.locked && door && isEnablerLock(door) && facilityState) {
    const active = activeEnablersForDoor(door.id, door, facilityState)
    if (active.length) return `locked · ${active.join(' + ')} ready`
    return 'locked · needs power or manual'
  }
  if (state.locked) return 'locked'
  if (state.lockBroken) return 'closed · lock broken'
  return 'closed'
}

export function lockHintForDoor(door, playerRoomId, inventory, facilityState, catalog = {}) {
  if (!door) return ''
  if (isEnablerLock(door)) {
    const active = activeEnablersForDoor(door.id, door, facilityState)
    if (active.length) return `Opener enabled (${active.join(', ')})`
    return 'Engage manual release or restore station power'
  }
  const freeFrom = lockFreeFromRoom(door)
  if (freeFrom && playerRoomId === freeFrom) return 'Lock thumb turn — no key needed'
  const keyId = requiredKeyId(door)
  if (!keyId) return ''
  if (hasItem(inventory, keyId)) {
    const name = catalog[keyId]?.name ?? keyId.replace(/-/g, ' ')
    return `Key in pocket (${name})`
  }
  const name = catalog[keyId]?.name ?? keyId.replace(/-/g, ' ')
  return `Need key: ${name}`
}
