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
    indoor.indoor.currentStand = 'stairs-bottom'
    place.value = 'indoors'

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.indoor.currentStand).toBe('stairs-bottom')

    indoor.indoor.currentStand = null
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(indoor.indoor.currentStand).toBe('stairs-bottom')

    snapshot.indoor.currentStand = 'missing-stand'
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(indoor.indoor.currentStand).toBe('midway')
  })

  it('migrates v1 barrierStand saves to stand', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    const legacy = {
      version: 1,
      place: 'outdoors',
      flags: [],
      storySeen: [],
      endCardDismissed: false,
      outdoor: {
        currentId: 'south-pines',
        discovered: ['origin', 'south-pines'],
        barrierStand: { x: -42, y: 38 },
        lastBlocked: 'fence',
        mode: 'explored',
      },
      indoor: {
        currentRoom: null,
        exteriorNode: indoor.building.exterior?.entry,
        discovered: [],
        revealed: [],
        level: 'first',
        viewLevel: 'first',
        doorState: indoor.indoor.doorState,
        inventory: [],
        pickupsTaken: [],
        facility: { hydroOnline: false, manualMode: {} },
        completedActions: [],
        avatarWaypoint: null,
      },
    }

    const ok = applySnapshot(legacy, { gameState, place, outdoor, indoor })
    expect(ok).toBe(true)
    expect(outdoor.state.stand).toEqual({ x: -42, y: 38 })
    expect(outdoor.state.lastBlocked).toBe('fence')
    expect(outdoor.mode).toBe('gameplay')
  })

  it('persists global character holdings and migrates legacy indoor inventory', () => {
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

    const legacy = {
      ...snapshot,
      version: 2,
      character: undefined,
      indoor: {
        ...snapshot.indoor,
        inventory: ['hallway-small-bay-key'],
      },
    }
    gameState.character.holdings.stacks = {}
    gameState.character.holdings.instances = {}
    expect(applySnapshot(legacy, { gameState, place, outdoor, indoor })).toBe(true)
    expect(itemQuantity(gameState.character.holdings, 'hallway-small-bay-key')).toBe(1)
  })

  it('round-trips authored game time without using wall-clock elapsed time', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    gameState.clock = { elapsedMinutes: 185, minuteOfDay: 665, day: 2 }
    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })

    gameState.clock = { elapsedMinutes: 999, minuteOfDay: 999, day: 9 }
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(gameState.clock).toEqual({ elapsedMinutes: 185, minuteOfDay: 665, day: 2 })
  })
})
