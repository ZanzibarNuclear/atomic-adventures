import buildingData from '../content/world/utility-station.yaml'
import { buildBuilding } from '../src/composables/useGrid.js'
import {
  buildInitialDoorState,
  canToggleLockFromRoom,
  toggleDoorLock,
  applyEnablerAutoUnlock,
  unlockDoor,
} from '../src/composables/useDoors.js'
import { createInventory, addItem, hasItem } from '../src/composables/useInventory.js'

const b = buildBuilding(buildingData)
const ds = buildInitialDoorState(b.areaId, b)
const inventory = createInventory()
const facility = { powerOn: false, manualMode: {} }

let failed = 0
function fail(msg) {
  console.error('FAIL:', msg)
  failed++
}

// Hallway side: lock/unlock without key
const hallwayCheck = canToggleLockFromRoom(
  ds,
  b,
  b.areaId,
  'hallway-small-bay',
  'hallway',
  inventory,
  facility,
)
if (!hallwayCheck.ok) fail('hallway should toggle hallway-small-bay without key')
if (!toggleDoorLock(ds, b.areaId, 'hallway-small-bay', b, 'hallway', inventory, facility)) {
  fail('hallway toggle should succeed')
}

// Small bay side: needs key
const bayCheck = canToggleLockFromRoom(
  ds,
  b,
  b.areaId,
  'hallway-small-bay',
  'small-bay',
  inventory,
  facility,
)
if (bayCheck.ok || bayCheck.reason !== 'need-key') {
  fail('small-bay should require key to toggle hallway-small-bay')
}

addItem(inventory, 'hallway-small-bay-key')
const bayWithKey = canToggleLockFromRoom(
  ds,
  b,
  b.areaId,
  'hallway-small-bay',
  'small-bay',
  inventory,
  facility,
)
if (!bayWithKey.ok) fail('small-bay with key should toggle hallway-small-bay')

// Roll-up: needs enabler
const rollCheck = canToggleLockFromRoom(
  ds,
  b,
  b.areaId,
  'small-bay-roll',
  'small-bay',
  inventory,
  facility,
)
if (rollCheck.ok) fail('roll door should not unlock without enabler')

facility.manualMode['small-bay-roll'] = true
applyEnablerAutoUnlock(ds, b, b.areaId, facility)
const rollState = ds[`${b.areaId}:small-bay-roll`]
if (rollState?.locked) fail('manual mode should auto-unlock small-bay-roll')

facility.powerOn = true
applyEnablerAutoUnlock(ds, b, b.areaId, facility)
const largeRoll = ds[`${b.areaId}:large-bay-roll`]
if (largeRoll?.locked) fail('power should auto-unlock large-bay-roll')

// Pickups defined
if (!b.pickups?.length) fail('building should define pickups')
if (!hasItem(inventory, 'hallway-small-bay-key')) fail('inventory should hold added key')

if (failed) {
  process.exit(1)
}
console.log('OK — key/lock/enabler checks passed')
