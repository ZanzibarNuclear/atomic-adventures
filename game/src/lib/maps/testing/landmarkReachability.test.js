import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import { resolveAvatarPosition } from '../composables/useAvatarStand.js'
import {
  barrierBlocksReach,
  isLandmarkReachable,
} from '../composables/useTravelBarriers.js'
import { buildGameplayWorld, gameplayMoveTo, passCompoundGate } from './gameplayTravel.js'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'

describe('landmark reachability', () => {
  const world = buildTravelWorld(mapData)
  const uy = world.hexById['utility-yard']
  const drivewayStand = resolveAvatarPosition(uy, world.size)

  it('lands at the driveway stand when arriving from west-slope', () => {
    const ws = world.hexById['west-slope']
    const m = evaluateNeighborMove(world, ws, uy, world.resolveStand(ws))

    expect(m.result.stand.x).toBeCloseTo(drivewayStand.x, 0)
    expect(m.result.stand.y).toBeCloseTo(drivewayStand.y, 0)
    expect(
      isLandmarkReachable(uy, m.result.stand, world.ctx, world.size),
    ).toBe(true)
  })

  it('lands at the driveway stand when arriving from the-flats', () => {
    const mw = world.hexById['the-flats']
    const m = evaluateNeighborMove(world, mw, uy, world.resolveStand(mw))

    expect(m.result.stand.x).toBeCloseTo(drivewayStand.x, 0)
    expect(m.result.stand.y).toBeCloseTo(drivewayStand.y, 0)
    expect(
      isLandmarkReachable(uy, m.result.stand, world.ctx, world.size),
    ).toBe(true)
  })

  it('lands at the driveway stand when arriving from south-pines', () => {
    const sp = world.hexById['south-pines']
    const m = evaluateNeighborMove(world, sp, uy, world.resolveStand(sp))

    expect(m.result.stand.x).toBeCloseTo(drivewayStand.x, 0)
    expect(m.result.stand.y).toBeCloseTo(drivewayStand.y, 0)
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
