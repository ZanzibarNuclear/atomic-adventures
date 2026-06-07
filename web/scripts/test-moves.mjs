import buildingData from '../content/world/utility-station.yaml'
import {
  buildBuilding,
  movesFrom,
  mapVisibilityCtx,
  isRoomMapped,
  isDoorMapped,
  applyRevealDoorsForRoom,
  doorRevealKey,
  doorsOnLevel,
  exteriorStepOutMoves,
  levelBeams,
  roomsOnLevel,
} from '../src/composables/useGrid.js'
import { buildInitialDoorState, setDoorOpen, setAllDoorsOpen } from '../src/composables/useDoors.js'

const b = buildBuilding(buildingData)
const ds = buildInitialDoorState(b.areaId, b)

function mappedOnLevel(level, discovered, revealed = []) {
  const ctx = mapVisibilityCtx(new Set(discovered), revealed, b, ds, b.areaId)
  return roomsOnLevel(b, level)
    .filter((r) => isRoomMapped(r, ctx))
    .map((r) => r.id)
    .sort()
}

console.log('start (large-bay, 1F):', mappedOnLevel('first', [b.start]))
console.log('start (large-bay, 2F):', mappedOnLevel('second', [b.start]))

const startCtx = mapVisibilityCtx(new Set([b.start]), [], b, ds, b.areaId)
let m = movesFrom(b, b.start, 'first', ds, startCtx)
console.log('large-bay moves:', m.map((x) => `${x.toRoomId} (${x.kind})`))

m = movesFrom(b, 'garage-stair', 'first', ds, mapVisibilityCtx(new Set(['large-bay', 'garage-stair']), [], b, ds, b.areaId))
console.log('garage-stair moves (door closed):', m.map((x) => x.toRoomId))

setDoorOpen(ds, b.areaId, 'conference-garage-stair', true)
m = movesFrom(b, 'garage-stair', 'first', ds, mapVisibilityCtx(new Set(['large-bay', 'garage-stair']), [], b, ds, b.areaId))
console.log('garage-stair moves (door open):', m.map((x) => x.toRoomId))

const visibleDoors = doorsOnLevel(b, 'first', ds)
  .filter((d) => isDoorMapped(b.doorById[d.id], startCtx))
  .map((d) => d.id)
  .sort()
console.log('visible 1F doors from large-bay:', visibleDoors)

const confCtx = mapVisibilityCtx(new Set(['conference']), [], b, ds, b.areaId, false, 'conference')
const confDoors = doorsOnLevel(b, 'second', ds)
  .filter((d) => isDoorMapped(b.doorById[d.id], confCtx))
  .map((d) => d.id)
  .sort()
console.log('visible 2F doors from conference:', confDoors)

m = movesFrom(b, 'library', 'first', ds, mapVisibilityCtx(new Set(['library']), new Set(), b, ds, b.areaId))
console.log('library moves (closed):', m.map((x) => x.toRoomId))

setDoorOpen(ds, b.areaId, 'library-corridor', true)
m = movesFrom(b, 'library', 'first', ds, mapVisibilityCtx(new Set(['library']), new Set(), b, ds, b.areaId))
console.log('library moves (corridor door open):', m.map((x) => x.toRoomId))
console.log(
  'mapped after opening corridor door:',
  mappedOnLevel('first', ['library'], ['corridor', 'library']),
)

const corridorCtx = mapVisibilityCtx(
  new Set(['corridor']),
  [],
  b,
  ds,
  b.areaId,
  false,
  'corridor',
)
const corridorDoorVisible = isDoorMapped(b.doorById['library-corridor'], corridorCtx)
console.log('library-corridor visible from corridor (no library visit):', corridorDoorVisible)
if (!corridorDoorVisible) {
  console.error('FAIL: library-corridor door must show when standing in corridor')
  process.exit(1)
}

const controlRevealed = new Set()
applyRevealDoorsForRoom(b, controlRevealed, 'control-room')
const lobbyCtx = mapVisibilityCtx(
  new Set(['control-lobby']),
  controlRevealed,
  b,
  ds,
  b.areaId,
  false,
  'control-lobby',
)
const bathDoorFromLobby = isDoorMapped(b.doorById['control-room-bathroom'], lobbyCtx)
console.log('control-room-bathroom visible from lobby after control-room visit:', bathDoorFromLobby)
if (!bathDoorFromLobby) {
  console.error('FAIL: bathroom door must persist after exploring control room')
  process.exit(1)
}
if (!controlRevealed.has(doorRevealKey('control-room-bathroom'))) {
  console.error('FAIL: control-room-bathroom should be in revealed set')
  process.exit(1)
}

const lobbyOnlyCtx = mapVisibilityCtx(new Set(['control-lobby']), [], b, ds, b.areaId)
const lobbyBeams = levelBeams(b, 'first', lobbyOnlyCtx)
console.log('open-garage beams from lobby only:', lobbyBeams.length)
if (lobbyBeams.length > 0) {
  console.error('FAIL: bay beam must stay hidden until bays are mapped')
  process.exit(1)
}

const bayCtx = mapVisibilityCtx(new Set(['large-bay']), [], b, ds, b.areaId)
const bayBeams = levelBeams(b, 'first', bayCtx)
console.log('open-garage beams from large-bay:', bayBeams.length)
if (bayBeams.length !== 1) {
  console.error('FAIL: bay beam should show once bays are mapped')
  process.exit(1)
}

setDoorOpen(ds, b.areaId, 'lobby-exterior', true)
const lobbyStepOut = exteriorStepOutMoves(b, 'control-lobby', ds, b.areaId)
console.log('lobby step-out moves (door open):', lobbyStepOut.map((m) => m.toExteriorNode))
if (lobbyStepOut.length !== 1 || lobbyStepOut[0].toExteriorNode !== 'lobby-exterior-front') {
  console.error('FAIL: lobby should step out to lobby-exterior-front')
  process.exit(1)
}

setDoorOpen(ds, b.areaId, 'large-bay-roll', true)
const bayStepOut = exteriorStepOutMoves(b, 'large-bay', ds, b.areaId)
console.log('large-bay step-out moves:', bayStepOut.map((m) => m.toExteriorNode))
if (!bayStepOut.some((m) => m.toExteriorNode === 'large-bay-roll-front')) {
  console.error('FAIL: large bay should step out to roll-up footpath node')
  process.exit(1)
}

setAllDoorsOpen(ds, b.areaId, b, true)
m = movesFrom(b, 'library', 'first', ds, mapVisibilityCtx(new Set(['library']), new Set(), b, ds, b.areaId, true))
console.log('library moves (all open, builder):', m.map((x) => x.toRoomId))
