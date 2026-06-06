import buildingData from '../content/world/utility-station.yaml'
import { buildBuilding, movesFrom, mapVisibilityCtx } from '../src/composables/useGrid.js'
import { buildInitialDoorState, setDoorOpen, setAllDoorsOpen } from '../src/composables/useDoors.js'

const b = buildBuilding(buildingData)
const ds = buildInitialDoorState(b.areaId, b)
const libLinks = b.links.filter((l) => l.from === 'library' || l.to === 'library')
console.log('library links:', JSON.stringify(libLinks, null, 2))
console.log('corridor:', b.roomById['corridor'])

let m = movesFrom(b, 'library', 'first', ds, mapVisibilityCtx(new Set(['library']), new Set(), b, ds, b.areaId))
console.log('closed:', m.map((x) => x.toRoomId))

setDoorOpen(ds, b.areaId, 'library-corridor', true)
m = movesFrom(b, 'library', 'first', ds, mapVisibilityCtx(new Set(['library']), new Set(), b, ds, b.areaId))
console.log('corridor door open:', m.map((x) => x.toRoomId))

setAllDoorsOpen(ds, b.areaId, b, true)
m = movesFrom(b, 'library', 'first', ds, mapVisibilityCtx(new Set(['library']), new Set(), b, ds, b.areaId, true))
console.log('all open:', m.map((x) => x.toRoomId))
