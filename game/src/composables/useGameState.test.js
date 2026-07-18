import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mapData } from '../lib/testing/content.js'
import { utilityData } from '../lib/testing/content.js'
import { useOutdoorWorld } from '../lib/maps/composables/useOutdoorWorld.js'
import { buildBuilding } from '../lib/maps/composables/useGrid.js'
import { buildInitialDoorState } from '../lib/maps/composables/useDoors.js'
import {
  SAVE_VERSION,
  captureSnapshot,
  applySnapshot,
  createGameState,
  setPlayMode,
} from './useGameState.js'
import { addItem, itemQuantity } from '../lib/character/holdings.js'

function buildTestHarness() {
  const outdoor = useOutdoorWorld(mapData)
  const building = buildBuilding(utilityData)
  const gameState = createGameState({ mapData, buildingData: utilityData })
  const place = ref('outdoors')
  const indoor = {
    building,
    indoor: {
      currentRoom: null,
      currentStand: null,
      exteriorNode: null,
      discovered: new Set(),
      revealed: new Set(),
      level: 'first',
      viewLevel: 'first',
      doorState: buildInitialDoorState(building.areaId, building),
      inventory: null,
      pickupsTaken: new Set(),
      facility: { hydroOnline: false, manualMode: {} },
      completedActions: new Set(),
      avatarWaypoint: null,
      moving: false,
      flags: gameState.flags,
    },
  }
  return { outdoor, indoor, gameState, place }
}

describe('useGameState save roundtrip', () => {
  it('does not persist an in-flight indoor animation waypoint', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    indoor.indoor.exteriorNode = indoor.building.exterior.entry
    indoor.indoor.avatarWaypoint = { x: 1.25, y: 3.5 }
    indoor.indoor.moving = true

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.indoor.avatarWaypoint).toBeNull()

    const ok = applySnapshot(snapshot, { gameState, place, outdoor, indoor })
    expect(ok).toBe(true)
    expect(indoor.indoor.avatarWaypoint).toBeNull()
    expect(indoor.indoor.moving).toBe(false)
  })

  it('persists stand position through capture and apply', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()

    outdoor.state.currentId = 'lower-stand'
    outdoor.state.stand = outdoor.defaultStandForHex('lower-stand')
    outdoor.state.atBarrier = null
    outdoor.state.lastBlocked = null
    outdoor.moveTo('south-pines')
    const savedStand = { ...outdoor.state.stand }
    const savedAtBarrier = outdoor.state.atBarrier
    const savedLastBlocked = outdoor.state.lastBlocked

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.version).toBe(SAVE_VERSION)
    expect(snapshot.outdoor.stand).toEqual(savedStand)
    expect(snapshot.outdoor.atBarrier).toBe(savedAtBarrier)
    expect(snapshot.outdoor.lastBlocked).toBe(savedLastBlocked)

    outdoor.resetPlayer()
    expect(outdoor.state.currentId).toBe(mapData.start ?? mapData.journey[0])

    const ok = applySnapshot(snapshot, { gameState, place, outdoor, indoor })
    expect(ok).toBe(true)
    expect(outdoor.state.currentId).toBe('south-pines')
    expect(outdoor.state.stand).toEqual(savedStand)
    expect(outdoor.state.atBarrier).toBe(savedAtBarrier)
    expect(outdoor.state.lastBlocked).toBe(savedLastBlocked)
  })

  it('persists the previous outdoor hex used for local-map entry selection', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    outdoor.state.currentId = 'utility-yard'
    outdoor.state.previousId = 'the-flats'

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.outdoor.previousId).toBe('the-flats')

    outdoor.state.previousId = null
    const ok = applySnapshot(snapshot, { gameState, place, outdoor, indoor })

    expect(ok).toBe(true)
    expect(outdoor.state.previousId).toBe('the-flats')
  })

  it('persists discovered barrier openings through capture and apply', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    outdoor.state.discoveredOpenings = ['the-flats-ford', 'south-pines-hole']

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.outdoor.discoveredOpenings).toEqual([
      'the-flats-ford',
      'south-pines-hole',
    ])

    outdoor.state.discoveredOpenings = []
    const ok = applySnapshot(snapshot, { gameState, place, outdoor, indoor })

    expect(ok).toBe(true)
    expect(outdoor.state.discoveredOpenings).toEqual([
      'the-flats-ford',
      'south-pines-hole',
    ])
  })

  it('persists outdoor passage open and closed state through capture and apply', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    outdoor.state.passageStates = {
      'compound-gate': true,
      'service-gate': false,
    }

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.outdoor.passageStates).toEqual({
      'compound-gate': true,
      'service-gate': false,
    })

    outdoor.state.passageStates = {}
    const ok = applySnapshot(snapshot, { gameState, place, outdoor, indoor })

    expect(ok).toBe(true)
    expect(outdoor.state.passageStates).toEqual({
      'compound-gate': true,
      'service-gate': false,
    })
  })

  it('persists an indoor room stand and falls back when it no longer exists', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    indoor.indoor.currentRoom = 'large-bay'
    indoor.indoor.currentStand = 'stair:garage-stair:bottom'
    place.value = 'indoors'

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.indoor.currentStand).toBe('stair:garage-stair:bottom')

    indoor.indoor.currentStand = null
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(indoor.indoor.currentStand).toBe('stair:garage-stair:bottom')

    snapshot.indoor.currentStand = 'missing-stand'
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(indoor.indoor.currentStand).toBe('midway')
  })

  it('treats a saved indoor room as authoritative over a stale exterior node', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    indoor.indoor.currentRoom = 'large-bay'
    indoor.indoor.currentStand = 'midway'
    indoor.indoor.exteriorNode = 'large-bay-man-front'
    place.value = 'indoors'

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.indoor.currentRoom).toBe('large-bay')
    expect(snapshot.indoor.exteriorNode).toBeNull()

    snapshot.indoor.exteriorNode = 'large-bay-man-front'
    indoor.indoor.currentRoom = null
    indoor.indoor.currentStand = null
    indoor.indoor.exteriorNode = 'large-bay-man-front'

    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(place.value).toBe('indoors')
    expect(indoor.indoor.currentRoom).toBe('large-bay')
    expect(indoor.indoor.currentStand).toBe('midway')
    expect(indoor.indoor.exteriorNode).toBeNull()
  })

  it('persists global character holdings', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    addItem(gameState.character.holdings, gameState.character.definitions, 'lobby-exterior-key', 1, {
      validateDefinition: false,
    })

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.version).toBe(SAVE_VERSION)
    expect(itemQuantity(snapshot.character.holdings, 'lobby-exterior-key')).toBe(1)
    expect(snapshot.indoor.inventory).toBeUndefined()

    gameState.character.holdings.stacks = {}
    gameState.character.holdings.instances = {}
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(itemQuantity(gameState.character.holdings, 'lobby-exterior-key')).toBe(1)
    expect(indoor.indoor.inventory).toBeNull()
  })

  it('persists completed lesson progress separately from character knowledge', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    gameState.lessons = {
      'hydro-power-intro': { completedAt: 'lesson-passed' },
    }

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.lessons['hydro-power-intro'].completedAt).toBe('lesson-passed')

    gameState.lessons = {}
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(gameState.lessons['hydro-power-intro'].completedAt).toBe('lesson-passed')
  })

  it('round-trips authored game time without using wall-clock elapsed time', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    gameState.clock = { elapsedMinutes: 185, minuteOfDay: 665, day: 2 }
    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })

    gameState.clock = { elapsedMinutes: 999, minuteOfDay: 999, day: 9 }
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(gameState.clock).toEqual({ elapsedMinutes: 185, minuteOfDay: 665, day: 2 })
  })

  it('persists hydro generator facility state separately from indoor door state', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    gameState.facilities.hydro = {
      ...gameState.facilities.hydro,
      online: true,
      intakeClear: true,
      intakeOpen: true,
      startupComplete: true,
      manualValves: {
        upstreamOpen: true,
        powerhouseOpen: true,
      },
      lastCheckpointElapsedMinutes: 44,
      eventLog: [
        {
          eventId: 'hydro-event-0044-online',
          plantId: 'upper-penstock',
          elapsedMinutes: 44,
          type: 'state-transition',
          source: 'host',
          actor: 'player',
          label: 'Hydro generator online',
          payload: { online: true },
        },
      ],
      debrisFraction: 0,
      leakageFraction: 0.1,
    }

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.facilities.hydro.online).toBe(true)
    expect(snapshot.facilities.hydro.leakageFraction).toBe(0.1)

    gameState.facilities.hydro.online = false
    indoor.indoor.facility.hydroOnline = false

    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(gameState.facilities.hydro.online).toBe(true)
    expect(gameState.facilities.hydro.manualValves.powerhouseOpen).toBe(true)
    expect(gameState.facilities.hydro.eventLog).toHaveLength(1)
    expect(indoor.indoor.facility.hydroOnline).toBe(true)
  })

  it('persists play mode and story progress', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    setPlayMode(gameState, 'story', {
      activeArcId: 'part-i-station',
      activeBeatId: 'understand-building',
    })
    gameState.story.completedBeatIds = ['solve-first-crisis']
    gameState.story.completedArcIds = ['part-i-station']
    gameState.story.dismissedCompletionArcIds = ['part-i-opener']
    gameState.storySeen = new Set(['control-room'])
    gameState.milestones = { 'day1.complete': { completedAt: 'nightfall' } }

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.version).toBe(SAVE_VERSION)
    expect(snapshot.playMode).toBe('story')
    expect(snapshot.milestones).toEqual({ 'day1.complete': { completedAt: 'nightfall' } })
    expect(snapshot.story).toEqual({
      activeArcId: 'part-i-station',
      activeBeatId: 'understand-building',
      completedBeatIds: ['solve-first-crisis'],
      enteredBeatIds: [],
      seenSceneIds: ['control-room'],
      completedArcIds: ['part-i-station'],
      dismissedCompletionArcIds: ['part-i-opener'],
    })
    setPlayMode(gameState, 'open-world')
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(gameState.playMode).toBe('story')
    expect(gameState.story.activeArcId).toBe('part-i-station')
    expect(gameState.story.activeBeatId).toBe('understand-building')
    expect(gameState.story.completedBeatIds).toEqual(['solve-first-crisis'])
    expect(gameState.story.completedArcIds).toEqual(['part-i-station'])
    expect(gameState.story.dismissedCompletionArcIds).toEqual(['part-i-opener'])
    expect(gameState.story.seenSceneIds).toEqual(['control-room'])
    expect(gameState.milestones).toEqual({ 'day1.complete': { completedAt: 'nightfall' } })
  })

  it('normalizes older saves to story mode', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    delete snapshot.playMode

    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(gameState.playMode).toBe('story')
    expect(gameState.story).toEqual({
      activeArcId: 'part-i-opener',
      activeBeatId: null,
      completedBeatIds: [],
      enteredBeatIds: [],
      seenSceneIds: [],
      completedArcIds: [],
      dismissedCompletionArcIds: [],
    })
  })

  it('persists open-world mode without active story progress', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    setPlayMode(gameState, 'open-world')

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.playMode).toBe('open-world')
    expect(snapshot.story).toBeNull()

    setPlayMode(gameState, 'story', { activeBeatId: 'intro' })
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(gameState.playMode).toBe('open-world')
    expect(gameState.story).toBeNull()
  })

})
