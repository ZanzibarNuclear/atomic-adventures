import { describe, expect, it } from 'vitest'
import mapData from '../../content/world/map.yaml'
import {
  buildTravelWorld,
  offeredMoves,
  adjacentHexes,
} from '../lib/maps/testing/travelWorld.js'
import {
  defaultMovementLabel,
  getMovementOptions,
  buildOutdoorSearchActions,
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
  return {
    currentHexData: fromHex,
    moves: routeMoves,
    directMoves,
    isAdjacentHex: (id) => neighborIds.has(id),
    _pendingBeat: pendingBeat,
  }
}

describe('defaultMovementLabel', () => {
  it('prefixes compass direction from the move', () => {
    expect(defaultMovementLabel({ label: 'west' })).toBe('Go west')
    expect(defaultMovementLabel({ label: 'northwest' })).toBe('Go northwest')
  })

  it('falls back when direction is missing', () => {
    expect(defaultMovementLabel({})).toBe('Go onward')
  })
})

describe('getMovementOptions', () => {
  it('lists offerable directions (departure-hex barriers only)', () => {
    const outdoor = outdoorAt('lower-stand')
    const options = getMovementOptions(outdoor, null)
    const dests = new Map(options.map((o) => [o.toHexId, o.label]))

    expect(dests.get('south-pines')).toBe('Go west')
    expect(dests.get('center-pines')).toMatch(/^Go /)
    expect(dests.get('east-pines')).toMatch(/^Go /)
  })

  it('uses story choice text instead of compass labels for covered destinations', () => {
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

  it('does not duplicate a destination in both story and movement options', () => {
    const pendingBeat = {
      choices: [{ text: 'Keep walking west', go_hex: 'east-pines' }],
    }
    const outdoor = outdoorAt('trailhead')
    const options = getMovementOptions(outdoor, pendingBeat)
    const eastPines = options.filter((o) => o.toHexId === 'east-pines')

    expect(eastPines).toHaveLength(1)
    expect(eastPines[0].kind).toBe('story')
  })

  it('offers fence-stop entries from center-pines to south-pines', () => {
    const outdoor = outdoorAt('center-pines')
    const options = getMovementOptions(outdoor, null)
    const dests = options.map((o) => o.toHexId)

    expect(dests).toContain('south-pines')
  })

  it('still offers story choices to adjacent hexes regardless of barriers', () => {
    const pendingBeat = {
      choices: [
        { text: 'Head downhill to the south', go_hex: 'south-pines' },
      ],
    }
    const outdoor = outdoorAt('center-pines')
    const options = getMovementOptions(outdoor, pendingBeat)

    expect(options.some((o) => o.toHexId === 'south-pines')).toBe(true)
  })

  it('derives labels from move geometry, not map hex fields', () => {
    const outdoor = outdoorAt('lower-stand')
    const { directMoves } = offeredMoves(
      world,
      outdoor.currentHexData,
      world.resolveStand(outdoor.currentHexData),
    )
    const centerMove = directMoves.find((m) => m.toHexId === 'center-pines')
    const options = getMovementOptions(outdoor, null)
    const center = options.find((o) => o.toHexId === 'center-pines')

    expect(world.hexById['lower-stand'].travel).toBeUndefined()
    expect(center?.label).toBe(defaultMovementLabel(centerMove))
  })

  it('labels fence search from hidden hole openings, not riverbank default', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'south-pines'
    outdoor.state.stand = outdoor.defaultStandForHex('south-pines')
    outdoor.state.atBarrier = null
    outdoor.state.lastBlocked = null

    const actions = buildOutdoorSearchActions(outdoor)
    expect(actions).toHaveLength(1)
    expect(actions[0].label).toBe('Search along the fence')
    expect(
      hiddenOpeningsInHex(mapData.features, 'south-pines').some(
        (f) => f.kind === 'hole',
      ),
    ).toBe(true)
  })
})
