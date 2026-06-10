import buildingData from '../content/world/utility-station.yaml'
import { buildBuilding } from '../src/composables/useGrid.js'
import {
  buildInitialDoorState,
  applyEnablerAutoUnlock,
} from '../src/composables/useDoors.js'
import {
  createFlags,
  hasFlag,
  requireSatisfied,
  setFlags,
} from '../src/composables/useFlags.js'

const b = buildBuilding(buildingData)
const ds = buildInitialDoorState(b.areaId, b)
const flags = createFlags()
const completed = new Set()
const facility = { hydroOnline: false, manualMode: {} }

let failed = 0
function fail(msg) {
  console.error('FAIL:', msg)
  failed++
}

function availableActions({ room, exteriorNode }) {
  return (b.actions ?? []).filter((action) => {
    if (action.room && action.room !== room) return false
    if (action.exteriorNode && action.exteriorNode !== exteriorNode) return false
    if (!action.room && !action.exteriorNode) return false
    if (action.once !== false && completed.has(action.id)) return false
    return requireSatisfied(action.require, flags)
  })
}

function perform(actionId) {
  const action = b.actions.find((a) => a.id === actionId)
  if (!action) return fail(`missing action ${actionId}`)
  setFlags(flags, action.sets)
  if (action.powerOn) {
    facility.hydroOnline = true
    applyEnablerAutoUnlock(ds, b, b.areaId, facility)
  }
  if (action.once !== false) completed.add(actionId)
}

if (!b.actions?.length) fail('building should define hydro actions')

const libraryActions = availableActions({ room: 'library' })
if (!libraryActions.some((a) => a.id === 'library-read-hydro')) {
  fail('library should offer read-hydro action')
}

perform('library-read-hydro')
if (!hasFlag(flags, 'hydro.discovered')) fail('library read should set hydro.discovered')

const controlBeforeOps = availableActions({ room: 'control-room' })
if (!controlBeforeOps.some((a) => a.id === 'read-micro-hydro-ops')) {
  fail('control room should offer ops manual')
}
if (controlBeforeOps.some((a) => a.id === 'connect-power')) {
  fail('connect power should not be available yet')
}

perform('read-micro-hydro-ops')
if (!hasFlag(flags, 'hydro.outdoor-actions')) fail('ops manual should enable outdoor actions')

const upstream = availableActions({ exteriorNode: 'upstream-bank' })
if (!upstream.some((a) => a.id === 'clear-intake-debris')) {
  fail('upstream should offer clear debris after ops manual')
}

perform('clear-intake-debris')
perform('align-pipeflow')
perform('open-turbine-valve')

const connect = availableActions({ room: 'control-room' })
if (!connect.some((a) => a.id === 'connect-power')) {
  fail('control room should offer connect power after field steps')
}

perform('connect-power')
if (!hasFlag(flags, 'hub.hydro_online')) fail('connect power should set hub.hydro_online')
if (!facility.hydroOnline) fail('connect power should turn hydroOnline on')

const largeRoll = ds[`${b.areaId}:large-bay-roll`]
if (largeRoll?.locked) fail('power on should unlock roll-up doors')

const charge = availableActions({ room: 'small-bay' })
if (!charge.some((a) => a.id === 'charge-ev')) {
  fail('small bay should offer EV charge when power is on')
}

if (failed) {
  process.exit(1)
}
console.log('OK — hydro startup action chain passed')
