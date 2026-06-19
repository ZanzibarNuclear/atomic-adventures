import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import mapData from '../../content/world/map.yaml'
import utilityData from '../../content/world/utility-station.yaml'
import { useOutdoorWorld } from '../lib/maps/composables/useOutdoorWorld.js'
import { buildBuilding } from '../lib/maps/composables/useGrid.js'
import { buildInitialDoorState } from '../lib/maps/composables/useDoors.js'
import { createInventory } from '../lib/maps/composables/useInventory.js'
import {
  SAVE_VERSION,
  captureSnapshot,
  applySnapshot,
  createGameState,
} from './useGameState.js'

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
      inventory: createInventory(),
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

  it('persists discovered barrier openings through capture and apply', () => {
    const { outdoor, indoor, gameState, place } = buildTestHarness()
    outdoor.state.discoveredOpenings = ['mid-west-ford', 'south-pines-hole']

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.outdoor.discoveredOpenings).toEqual([
      'mid-west-ford',
      'south-pines-hole',
    ])

    outdoor.state.discoveredOpenings = []
    const ok = applySnapshot(snapshot, { gameState, place, outdoor, indoor })

    expect(ok).toBe(true)
    expect(outdoor.state.discoveredOpenings).toEqual([
      'mid-west-ford',
      'south-pines-hole',
    ])
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
    expect(indoor.indoor.currentStand).toBe('center')
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
        discovered: ['trailhead', 'south-pines'],
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
    gameState.character.inventory.add('lobby-exterior-key')

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.version).toBe(SAVE_VERSION)
    expect(snapshot.character.holdings.items['lobby-exterior-key']).toEqual({ quantity: 1 })
    expect(snapshot.indoor.inventory).toBeUndefined()

    gameState.character.inventory.clear()
    expect(applySnapshot(snapshot, { gameState, place, outdoor, indoor })).toBe(true)
    expect(gameState.character.inventory.has('lobby-exterior-key')).toBe(true)
    expect(indoor.indoor.inventory).toBe(gameState.character.inventory)

    const legacy = {
      ...snapshot,
      version: 2,
      character: undefined,
      indoor: {
        ...snapshot.indoor,
        inventory: ['hallway-small-bay-key'],
      },
    }
    gameState.character.inventory.clear()
    expect(applySnapshot(legacy, { gameState, place, outdoor, indoor })).toBe(true)
    expect(gameState.character.inventory.has('hallway-small-bay-key')).toBe(true)
  })
})
