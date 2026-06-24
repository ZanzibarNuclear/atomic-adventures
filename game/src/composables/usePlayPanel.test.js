import { describe, expect, it } from 'vitest'
import { mapData } from '../lib/testing/content.js'
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
  handleOutdoorPlayAction,
} from './usePlayPanel.js'
import { hiddenOpeningsInHex } from '../lib/maps/composables/useBarrierOpenings.js'
import { useOutdoorWorld } from '../lib/maps/composables/useOutdoorWorld.js'

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
    expect(south.kind).toBe('story')
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

  it('does not add movement options beside a story destination', () => {
    const pendingBeat = {
      choices: [{ text: 'Keep walking west', go_hex: 'east-pines' }],
    }
    const outdoor = outdoorAt('origin')
    const options = getMovementOptions(outdoor, pendingBeat)
    const eastPines = options.filter((o) => o.toHexId === 'east-pines')

    expect(eastPines).toHaveLength(1)
    expect(eastPines[0].kind).toBe('story')
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
    outdoor.state.currentId = 'mid-west'
    outdoor.state.stand = outdoor.defaultStandForHex('mid-west')

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
})
