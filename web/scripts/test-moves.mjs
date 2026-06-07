import buildingData from '../content/world/utility-station.yaml'
import {
  buildBuilding,
  movesFrom,
  mapVisibilityCtx,
  isRoomMapped,
  isDoorMapped,
  doorsOnLevel,
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

setAllDoorsOpen(ds, b.areaId, b, true)
m = movesFrom(b, 'library', 'first', ds, mapVisibilityCtx(new Set(['library']), new Set(), b, ds, b.areaId, true))
console.log('library moves (all open, builder):', m.map((x) => x.toRoomId))
