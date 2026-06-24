import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import { resolveStandPoint } from '../composables/useAvatarStand.js'
import {
  barrierBlocksReach,
  isLandmarkReachable,
} from '../composables/useTravelBarriers.js'
import { buildGameplayWorld, gameplayMoveTo, passCompoundGate } from './gameplayTravel.js'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'

describe('landmark reachability', () => {
  const world = buildTravelWorld(mapData)
  const uy = world.hexById['utility-yard']
  const expectedStand = (stand) => resolveStandPoint(uy, { stand }, world.size)

  it.each([
    ['driveway', 'west-slope'],
    ['upstream-corner', 'the-flats'],
    ['man-door', 'south-pines'],
  ])('lands at the %s stand when arriving from %s', (standId, fromHexId) => {
    const from = world.hexById[fromHexId]
    const stand = expectedStand(standId)
    const m = evaluateNeighborMove(world, from, uy, world.resolveStand(from))

    expect(m.result.stand.x).toBeCloseTo(stand.x, 0)
    expect(m.result.stand.y).toBeCloseTo(stand.y, 0)
    expect(
      isLandmarkReachable(uy, m.result.stand, world.ctx, world.size),
    ).toBe(true)
  })

  it('blocks reachability across a fence without an opening', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 0, y: 40 }
    const ctx = {
      barriers: [{ a: { x: -20, y: 20 }, b: { x: 20, y: 20 }, kind: 'fence' }],
      openings: [],
    }
    expect(barrierBlocksReach(from, to, ctx)).toBe(true)
  })

  it('allows reachability along the accessible side without using an opening', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 0, y: 40 }
    const ctx = {
      barriers: [{ a: { x: -20, y: 20 }, b: { x: 20, y: 20 }, kind: 'fence' }],
      openings: [{ kind: 'hole', x: 0, y: 20, r: 12 }],
    }
    expect(barrierBlocksReach(from, to, ctx)).toBe(true)
  })

  it('offers enter only when the landmark is reachable (gameplay)', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    for (const h of ['east-pines', 'center-pines', 'north-bend', 'gate-woods']) {
      gameplayMoveTo(outdoor, h)
    }
    passCompoundGate(outdoor)
    gameplayMoveTo(outdoor, 'west-slope')
    gameplayMoveTo(outdoor, 'utility-yard')

    expect(outdoor.atBuildingEntrance).toBe(true)

    outdoor.state.currentId = 'the-flats'
    outdoor.state.stand = outdoor.defaultStandForHex('the-flats')
    gameplayMoveTo(outdoor, 'utility-yard')
    expect(outdoor.atBuildingEntrance).toBe(true)
  })
})
