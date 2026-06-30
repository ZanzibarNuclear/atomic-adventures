import { describe, expect, it } from 'vitest'
import { characterDefinitions, mapData, utilityData } from '../lib/testing/content.js'
import {
  buildTravelWorld,
  offeredMoves,
  adjacentHexes,
} from '../lib/maps/testing/travelWorld.js'
import {
  getMovementOptions,
  buildOutdoorBarrierFollowActions,
  buildOutdoorPlayActions,
  buildOutdoorRouteActions,
  buildOutdoorSearchActions,
  buildStoryChoices,
  buildIndoorMovementActions,
  buildIndoorPlayActions,
  handleIndoorPlayAction,
  handleOutdoorPlayAction,
} from './usePlayPanel.js'
import { hiddenOpeningsInHex } from '../lib/maps/composables/useBarrierOpenings.js'
import { useOutdoorWorld } from '../lib/maps/composables/useOutdoorWorld.js'
import { useIndoorBuilding } from '../lib/maps/composables/useIndoorBuilding.js'
import { createCharacterState } from './useCharacterState.js'
import { createGameClock } from '../lib/character/gameTime.js'
import { createFlags } from '../lib/maps/composables/useFlags.js'
import { ref } from 'vue'

const world = buildTravelWorld(mapData)

function outdoorAt(hexId, pendingBeat = null) {
  const fromHex = world.hexById[hexId]
  const fromPos = world.resolveStand(fromHex)
  const { routeMoves, directMoves } = offeredMoves(world, fromHex, fromPos)
  const neighborIds = new Set(
    adjacentHexes(fromHex, world.hexes).map((h) => h.id),
  )
  const reachableIds = new Set([
    hexId,
    ...routeMoves.map((m) => m.toHexId),
    ...directMoves.map((m) => m.toHexId),
  ])
  const outdoor = useOutdoorWorld(mapData)
  outdoor.state.currentId = hexId
  outdoor.state.stand = fromPos
  return {
    currentHexData: fromHex,
    moves: routeMoves,
    directMoves,
    isAdjacentHex: (id) => neighborIds.has(id),
    canReachHex: (id) => reachableIds.has(id),
    _pendingBeat: pendingBeat,
  }
}

describe('getMovementOptions', () => {
  it('does not list generated outdoor movement directions', () => {
    const outdoor = outdoorAt('lower-stand')
    const options = getMovementOptions(outdoor, null)

    expect(options).toEqual([])
  })

  it('lists story choice text for reachable story destinations', () => {
    const pendingBeat = {
      choices: [
        { text: 'Continue west on the trail', go_hex: 'south-pines' },
      ],
    }
    const outdoor = outdoorAt('lower-stand')
    const options = getMovementOptions(outdoor, pendingBeat)
    const south = options.find((o) => o.toHexId === 'south-pines')

    expect(south).toBeDefined()
    expect(south.label).toBe('Continue west on the trail')
    expect(south.kind).toBeUndefined()
  })

  it('lists story choices that move to exterior path nodes', () => {
    const pendingBeat = {
      choices: [
        { text: 'Look for a way in', go_exterior_node: 'north-east-corner' },
      ],
    }
    const options = buildStoryChoices(pendingBeat)

    expect(options).toMatchObject([
      {
        id: 'story:0',
        label: 'Look for a way in',
      },
    ])
  })

  it('lists story choices on revisit beats', () => {
    const pendingBeat = {
      revisit: true,
      choices: [
        { text: 'Try the trail again', go_hex: 'south-pines' },
      ],
    }
    const outdoor = outdoorAt('lower-stand')
    const options = getMovementOptions(outdoor, pendingBeat)

    expect(options.map((option) => option.label)).toContain('Try the trail again')
  })

  it('omits disabled story choices from play actions', () => {
    const pendingBeat = {
      choices: [
        { text: 'Study the sealed controls', disabled: true },
        { text: 'Step back from the console' },
      ],
    }

    expect(buildStoryChoices(pendingBeat).map((option) => option.label)).toEqual([
      'Step back from the console',
    ])
  })

  it('does not add movement options beside a story destination', () => {
    const pendingBeat = {
      choices: [{ text: 'Keep walking west', go_hex: 'east-pines' }],
    }
    const outdoor = outdoorAt('origin')
    const options = getMovementOptions(outdoor, pendingBeat)
    const eastPines = options.filter((o) => o.toHexId === 'east-pines')

    expect(eastPines).toHaveLength(1)
    expect(eastPines[0].kind).toBeUndefined()
  })

  it('omits story choices to adjacent but unreachable hexes', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'south-pines'
    outdoor.state.stand = outdoor.defaultStandForHex('south-pines')

    const pendingBeat = {
      choices: [
        { text: 'Head west to lower stand', go_hex: 'lower-stand' },
      ],
    }
    const choices = buildStoryChoices(pendingBeat, (id) => outdoor.canReachHex(id))
    expect(choices.some((c) => c.toHexId === 'lower-stand')).toBe(false)
  })

  it('offers story choices only when enterable like movement options', () => {
    const pendingBeat = {
      choices: [
        { text: 'Head downhill to the south', go_hex: 'south-pines' },
      ],
    }
    const outdoor = outdoorAt('center-pines')
    const options = getMovementOptions(outdoor, pendingBeat)

    expect(options.some((o) => o.toHexId === 'south-pines')).toBe(true)
  })

  it('labels fence search from hidden hole openings, not riverbank default', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'south-pines'
    outdoor.state.stand = outdoor.defaultStandForHex('south-pines')
    outdoor.state.atBarrier = null
    outdoor.state.lastBlocked = null

    const actions = buildOutdoorSearchActions(outdoor)
    expect(actions).toHaveLength(1)
    expect(actions[0].label).toBe('Inspect the fence')
    expect(
      hiddenOpeningsInHex(mapData.features, 'south-pines').some(
        (f) => f.kind === 'hole',
      ),
    ).toBe(true)
  })

  it('keeps outdoor search actions in the contextual play action list', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'south-pines'
    outdoor.state.stand = outdoor.defaultStandForHex('south-pines')

    expect(buildOutdoorPlayActions(outdoor).map((action) => action.id)).toContain(
      'search:barrier',
    )
  })

  it('spends 20 minutes when inspecting the fence', () => {
    const gameState = {
      flags: new Set(),
      clock: createGameClock(),
      character: createCharacterState({
        items: [],
      stats: [{
        id: 'effort',
        label: 'Effort',
        type: 'meter',
        default: 0,
        drift: { perGameHour: { light: 3, moderate: 6 } },
      }],
        knowledge: [],
        skills: [],
        quests: [],
        documents: [],
      }),
    }
    const outdoor = useOutdoorWorld(mapData, gameState)
    outdoor.state.currentId = 'south-pines'
    outdoor.state.stand = outdoor.defaultStandForHex('south-pines')

    handleOutdoorPlayAction(outdoor, 'search:barrier')

    expect(gameState.clock.elapsedMinutes).toBe(20)
    expect(gameState.character.stats.effort).toBeCloseTo(2)
  })

  it('hides fence inspection after the hidden opening is found', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'south-pines'
    outdoor.state.stand = outdoor.defaultStandForHex('south-pines')
    outdoor.state.discoveredOpenings = ['south-pines-hole']

    const actions = buildOutdoorSearchActions(outdoor)

    expect(actions).toEqual([])
  })

  it('offers contextual route-following actions with route direction', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'road-fork'
    outdoor.state.stand = outdoor.defaultStandForHex('road-fork')

    expect(buildOutdoorRouteActions(outdoor).map((action) => action.label)).toEqual(
      expect.arrayContaining([
        'Follow the main road to the south',
        'Follow the vista drive to the west',
      ]),
    )
  })

  it('lets story choices replace route actions to the same destination', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'road-fork'
    outdoor.state.stand = outdoor.defaultStandForHex('road-fork')
    const pendingBeat = {
      choices: [{ text: 'Take the road toward the gate', go_hex: 'gate-woods' }],
    }

    const actions = buildOutdoorRouteActions(outdoor, pendingBeat)

    expect(actions.map((action) => action.toHexId)).not.toContain('gate-woods')
    expect(actions.map((action) => action.toHexId)).toContain('upper-gorge')
  })

  it('offers barrier-following actions with barrier direction', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'the-flats'
    outdoor.state.stand = outdoor.defaultStandForHex('the-flats')

    expect(buildOutdoorBarrierFollowActions(outdoor).map((action) => action.label)).toContain(
      'Walk southeast along the river',
    )
  })

  it('dispatches outdoor contextual actions to search and passage handlers', () => {
    const calls = []
    const outdoor = {
      canSearchHere: () => true,
      searchableOpenings: () => [],
      state: { atBarrier: 'fence', lastBlocked: null },
      searchBarrier: () => calls.push('search'),
      togglePassage: (id) => calls.push(`toggle:${id}`),
      crossPassage: (id) => calls.push(`passage:${id}`),
      moveTo: (id) => calls.push(`move:${id}`),
    }

    handleOutdoorPlayAction(outdoor, 'search:barrier')
    handleOutdoorPlayAction(outdoor, 'passage-toggle:compound-gate')
    handleOutdoorPlayAction(outdoor, 'passage:south-pines-hole')
    handleOutdoorPlayAction(outdoor, 'route:gate-woods')
    handleOutdoorPlayAction(outdoor, 'barrier:utility-yard')

    expect(calls).toEqual([
      'search',
      'toggle:compound-gate',
      'passage:south-pines-hole',
      'move:gate-woods',
      'move:utility-yard',
    ])
  })

  it('offers indoor exterior footpath movement as play actions', () => {
    const indoor = {
      indoorMoves: [
        {
          kind: 'path',
          toExteriorNode: 'north-east-corner',
          label: 'north along the footpath',
        },
        {
          kind: 'door',
          toRoomId: 'large-bay',
          label: 'through the door',
        },
      ],
    }

    expect(buildIndoorMovementActions(indoor)).toEqual([
      {
        id: 'move-exterior:north-east-corner',
        label: 'Go north along the footpath',
        kind: 'path',
      },
      {
        id: 'move-room:large-bay',
        label: 'Go through the door',
        kind: 'door',
      },
    ])
  })

  it('labels indoor entry, exit, stairs, pickups, and doors conversationally', () => {
    const indoor = {
      indoorMoves: [
        { kind: 'door', toRoomId: 'large-bay', label: 'through the door' },
        { kind: 'stairs', toRoomId: 'garage-stair', label: 'onto the garage stairs' },
        { kind: 'stairs', toRoomId: 'large-bay', label: 'down to the large bay' },
        { kind: 'path', toExteriorNode: 'large-bay-man-front', label: 'north along the footpath' },
      ],
      roomPickups: [{ id: 'wrench', label: 'wrench' }],
      carriedItems: [{ id: 'key', label: 'side garage door key' }],
      availableActions: [{ id: 'read-sign', verb: 'Read', label: 'service placard' }],
      nearbyDoors: [{ doorId: 'side-garage-door', toName: 'Yard' }],
      roomSwitches: [],
      building: {
        areaId: 'utility-station',
        levels: [],
        doorById: {
          'side-garage-door': { id: 'side-garage-door', label: 'side garage door' },
        },
      },
      indoor: {
        exteriorNode: 'large-bay-man-front',
        level: 'first',
        doorState: {
          'utility-station:side-garage-door': {
            open: true,
            locked: false,
            lockBroken: false,
          },
        },
        facility: {},
      },
      playerRoomId: 'large-bay',
      doorStateFor: (doorId) => indoor.indoor.doorState[`utility-station:${doorId}`],
      doorLockHint: () => '',
      canToggleDoorLock: () => true,
    }

    const labels = buildIndoorPlayActions(indoor).map((action) => action.label)

    expect(labels).toEqual(expect.arrayContaining([
      'Go inside',
      'Climb the stairs',
      'Descend the stairs',
      'Go north along the footpath',
      'Pick up the wrench',
      'Read the service placard',
      'Close the side garage door',
    ]))
    expect(labels).not.toContain('Put down the side garage door key')
    expect(labels.join(' ')).not.toMatch(/[–—]/)
  })

  it('labels room-to-exterior movement as going outside', () => {
    const indoor = {
      indoorMoves: [
        {
          kind: 'door',
          toExteriorNode: 'large-bay-man-front',
          label: 'out to the footpath',
        },
      ],
      indoor: { exteriorNode: null },
    }

    expect(buildIndoorMovementActions(indoor)).toEqual([
      {
        id: 'move-exterior:large-bay-man-front',
        label: 'Go outside',
        kind: 'door',
      },
    ])
  })

  it('labels movement through a door to a fogged room without revealing the room name', () => {
    const indoor = {
      indoorMoves: [
        {
          kind: 'door',
          toRoomId: 'conference',
          label: 'into the conference room',
        },
      ],
      indoor: {
        exteriorNode: null,
        discovered: new Set(['garage-stair']),
      },
    }

    expect(buildIndoorMovementActions(indoor)).toEqual([
      {
        id: 'move-room:conference',
        label: 'Enter the room',
        kind: 'door',
      },
    ])
  })

  it('labels movement to any fogged room without revealing the room name', () => {
    const indoor = {
      building: {
        roomById: {
          kitchen: { id: 'kitchen', label: 'Conference Kitchen' },
        },
      },
      indoorMoves: [
        {
          kind: 'open',
          toRoomId: 'kitchen',
          label: 'to Conference Kitchen',
        },
      ],
      indoor: {
        exteriorNode: null,
        discovered: new Set(['conference']),
      },
    }

    expect(buildIndoorMovementActions(indoor)).toEqual([
      {
        id: 'move-room:kitchen',
        label: 'Enter the room',
        kind: 'open',
      },
    ])

    indoor.indoor.discovered = new Set(['conference', 'kitchen'])

    expect(buildIndoorMovementActions(indoor)).toEqual([
      {
        id: 'move-room:kitchen',
        label: 'Go to Conference Kitchen',
        kind: 'open',
      },
    ])
  })

  it('normalizes manual release switch actions without em or en dashes', () => {
    const indoor = {
      indoorMoves: [],
      roomPickups: [],
      carriedItems: [],
      availableActions: [],
      nearbyDoors: [],
      roomSwitches: [{
        door: 'large-bay-roll',
        label: 'Manual release — large roll-up',
      }],
      building: { doorById: {} },
      indoor: {
        doorState: {},
        facility: { manualMode: {} },
      },
      playerRoomId: 'large-bay',
    }

    let actions = buildIndoorPlayActions(indoor)

    expect(actions.map((action) => action.label)).toContain('Release the large roll-up manually')
    expect(actions.map((action) => action.label).join(' ')).not.toMatch(/[–—]/)

    indoor.indoor.facility.manualMode['large-bay-roll'] = true
    actions = buildIndoorPlayActions(indoor)

    expect(actions.map((action) => action.label)).toContain('Engage the motor for the large roll-up')
    expect(actions.map((action) => action.label).join(' ')).not.toMatch(/[–—]/)
  })

  it('drops carried artifacts at the current stand and requires returning there to pick them up', () => {
    const place = ref('indoors')
    const gameState = {
      flags: createFlags(),
      character: createCharacterState(characterDefinitions, utilityData.holders ?? []),
    }
    const indoor = useIndoorBuilding(utilityData, useOutdoorWorld(mapData), {
      place,
      builderView: ref(false),
      gameState,
    })
    indoor.indoor.currentRoom = 'large-bay'
    indoor.indoor.exteriorNode = null
    indoor.indoor.currentStand = 'door:large-bay-man'

    indoor.tryPickup('large-bay-key-peg')
    expect(indoor.carriedItems.map((item) => item.id)).toContain('large-bay-man-key')

    indoor.dropItem('large-bay-man-key')
    expect(indoor.carriedItems.map((item) => item.id)).not.toContain('large-bay-man-key')
    expect(indoor.roomPickups.map((pickup) => pickup.item)).toContain('large-bay-man-key')

    indoor.indoor.currentStand = 'midway'
    expect(indoor.roomPickups.map((pickup) => pickup.item)).not.toContain('large-bay-man-key')

    indoor.indoor.currentStand = 'door:large-bay-man'
    const dropped = indoor.roomPickups.find((pickup) => pickup.item === 'large-bay-man-key')
    indoor.tryPickup(dropped.id)

    expect(indoor.carriedItems.map((item) => item.id)).toContain('large-bay-man-key')
  })

  it('only shows stand-specific pickup actions at the key and bolt cutter standpoints', () => {
    const place = ref('indoors')
    const indoor = useIndoorBuilding(utilityData, useOutdoorWorld(mapData), {
      place,
      builderView: ref(false),
      gameState: { flags: createFlags() },
    })
    indoor.indoor.currentRoom = 'large-bay'
    indoor.indoor.exteriorNode = null

    indoor.indoor.currentStand = 'midway'
    let actions = buildIndoorPlayActions(indoor)
    expect(actions.map((action) => action.id)).not.toContain('pickup:large-bay-key-peg')
    expect(actions.map((action) => action.id)).not.toContain('pickup:bolt-cutter')
    expect(actions.map((action) => action.label).join(' ')).not.toContain('Take the')

    indoor.indoor.currentStand = 'service-area'
    actions = buildIndoorPlayActions(indoor)
    expect(actions.map((action) => action.id)).toContain('pickup:bolt-cutter')
    expect(actions.map((action) => action.label)).toContain('Pick up the Bolt cutter on the garage bench')
    expect(actions.map((action) => action.id)).not.toContain('pickup:large-bay-key-peg')

    indoor.indoor.currentStand = 'door:large-bay-man'
    actions = buildIndoorPlayActions(indoor)
    expect(actions.map((action) => action.id)).toContain('pickup:large-bay-key-peg')
    expect(actions.map((action) => action.label)).toContain('Pick up the Key to the garage door')
    expect(actions.map((action) => action.id)).not.toContain('pickup:bolt-cutter')
  })

  it('keeps indoor movement before contextual actions in the play action list', () => {
    const indoor = {
      indoorMoves: [
        {
          kind: 'stand',
          toStandId: 'stairs-bottom',
          label: 'to Bottom of the stairs',
        },
      ],
      roomPickups: [{ id: 'wrench', label: 'Wrench' }],
      availableActions: [],
      nearbyDoors: [],
      roomSwitches: [],
      building: { doorById: {} },
      indoor: { doorState: new Map(), facility: {} },
      playerRoomId: 'large-bay',
    }

    expect(buildIndoorPlayActions(indoor).map((action) => action.id)).toEqual([
      'move-stand:stairs-bottom',
      'pickup:wrench',
    ])
  })

  it('omits locked door actions when the player cannot unlock them', () => {
    const indoor = {
      indoorMoves: [],
      roomPickups: [],
      availableActions: [],
      nearbyDoors: [{ doorId: 'side-door', toName: 'Side Door' }],
      roomSwitches: [],
      building: {
        areaId: 'utility-station',
        doorById: {
          'side-door': {
            id: 'side-door',
            label: 'Side Door',
            lock: { key: 'side-door-key' },
          },
        },
      },
      indoor: {
        doorState: {
          'utility-station:side-door': {
            open: false,
            locked: true,
            lockBroken: false,
          },
        },
        facility: {},
      },
      character: new Set(),
      playerRoomId: 'yard',
      doorStateFor: (doorId) => indoor.indoor.doorState[`utility-station:${doorId}`],
      doorLockHint: () => 'Needs a key.',
      canToggleDoorLock: () => false,
    }

    const actions = buildIndoorPlayActions(indoor)

    expect(actions.map((action) => action.id)).not.toContain('door-lock:side-door')
    expect(actions.some((action) => action.disabled)).toBe(false)
  })

  it('does not reveal fogged room names in door action labels', () => {
    const indoor = {
      indoorMoves: [],
      roomPickups: [],
      availableActions: [],
      nearbyDoors: [{ doorId: 'library-hallway', toRoomId: 'library', toName: 'Library' }],
      roomSwitches: [],
      building: {
        areaId: 'utility-station',
        roomById: {
          hallway: { id: 'hallway', label: 'Hallway', x: 0, y: 0, w: 2, h: 2 },
          library: { id: 'library', label: 'Library' },
        },
        doorById: {
          'library-hallway': { id: 'library-hallway', kind: 'man', at: { x: 0, y: 1 } },
        },
      },
      indoor: {
        discovered: new Set(['hallway']),
        doorState: {
          'utility-station:library-hallway': {
            open: false,
            locked: false,
            lockBroken: false,
          },
        },
        facility: {},
      },
      playerRoomId: 'hallway',
      doorStateFor: (doorId) => indoor.indoor.doorState[`utility-station:${doorId}`],
      doorLockHint: () => '',
      canToggleDoorLock: () => false,
    }

    let actions = buildIndoorPlayActions(indoor)

    expect(actions.map((action) => action.label)).toContain('Open the door')
    expect(actions.map((action) => action.label).join(' ')).not.toMatch(/library/i)
    expect(actions.map((action) => action.id)).not.toContain('door-lock:library-hallway')

    indoor.indoor.discovered = new Set(['hallway', 'library'])
    actions = buildIndoorPlayActions(indoor)

    expect(actions.map((action) => action.label)).toContain('Open the library door')
  })

  it('uses position labels to distinguish multiple fogged doors', () => {
    const indoor = {
      indoorMoves: [],
      roomPickups: [],
      availableActions: [],
      nearbyDoors: [
        { doorId: 'west-door', toRoomId: 'west-room', toName: 'West Room' },
        { doorId: 'east-door', toRoomId: 'east-room', toName: 'East Room' },
      ],
      roomSwitches: [],
      building: {
        areaId: 'utility-station',
        roomById: {
          hall: { id: 'hall', label: 'Hall', x: 0, y: 0, w: 4, h: 2 },
          'west-room': { id: 'west-room', label: 'West Room' },
          'east-room': { id: 'east-room', label: 'East Room' },
        },
        doorById: {
          'west-door': { id: 'west-door', kind: 'man', at: { x: 0, y: 1 } },
          'east-door': { id: 'east-door', kind: 'man', at: { x: 4, y: 1 } },
        },
      },
      indoor: {
        discovered: new Set(['hall']),
        doorState: {
          'utility-station:west-door': { open: false, locked: false, lockBroken: false },
          'utility-station:east-door': { open: false, locked: false, lockBroken: false },
        },
        facility: {},
      },
      playerRoomId: 'hall',
      doorStateFor: (doorId) => indoor.indoor.doorState[`utility-station:${doorId}`],
      doorLockHint: () => '',
      canToggleDoorLock: () => false,
    }

    const labels = buildIndoorPlayActions(indoor).map((action) => action.label)

    expect(labels).toEqual(expect.arrayContaining([
      'Open the west door',
      'Open the east door',
    ]))
    expect(labels.join(' ')).not.toMatch(/west room|east room/i)
  })

  it('lets indoor story choices replace matching generic movement actions', () => {
    const indoor = {
      indoorMoves: [
        {
          kind: 'path',
          toExteriorNode: 'north-east-corner',
          label: 'north along the footpath',
        },
        {
          kind: 'path',
          toExteriorNode: 'small-bay-roll-front',
          label: 'south along the footpath',
        },
      ],
    }
    const pendingBeat = {
      choices: [
        { text: 'Look for a way in', go_exterior_node: 'north-east-corner' },
      ],
    }

    expect(buildIndoorMovementActions(indoor, pendingBeat).map((action) => action.id)).toEqual([
      'move-exterior:small-bay-roll-front',
    ])
  })

  it('dispatches indoor movement play actions to movement handlers', () => {
    const calls = []
    const indoor = {
      moveToExteriorNode: (id) => calls.push(`exterior:${id}`),
      moveToStand: (id) => calls.push(`stand:${id}`),
      moveToRoom: (id) => calls.push(`room:${id}`),
    }

    handleIndoorPlayAction(indoor, 'move-exterior:north-east-corner')
    handleIndoorPlayAction(indoor, 'move-stand:stairs-bottom')
    handleIndoorPlayAction(indoor, 'move-room:large-bay')

    expect(calls).toEqual([
      'exterior:north-east-corner',
      'stand:stairs-bottom',
      'room:large-bay',
    ])
  })

  it('dispatches explicit indoor door actions without entering through open exterior doors', () => {
    const calls = []
    const indoor = {
      tryOpenDoor: (id) => calls.push(`open:${id}`),
      tryCloseDoor: (id) => calls.push(`close:${id}`),
      tryToggleDoor: (id) => calls.push(`toggle:${id}`),
      moveToRoom: (id) => calls.push(`room:${id}`),
    }

    handleIndoorPlayAction(indoor, 'door-open:garage-man')
    handleIndoorPlayAction(indoor, 'door-close:garage-man')

    expect(calls).toEqual([
      'open:garage-man',
      'close:garage-man',
    ])
  })
})
