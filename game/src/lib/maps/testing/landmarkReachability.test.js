import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
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

  it('lands at the driveway stand when arriving via hero-route', () => {
    const ws = world.hexById['west-slope']
    const m = evaluateNeighborMove(world, ws, uy, world.resolveStand(ws))

    expect(m.result.stand.x).toBeCloseTo(drivewayStand.x, 0)
    expect(m.result.stand.y).toBeCloseTo(drivewayStand.y, 0)
    expect(
      isLandmarkReachable(uy, m.result.stand, world.ctx, world.size),
    ).toBe(true)
  })

  it('west-bank stand cannot reach the utility station landmark', () => {
    const mw = world.hexById['mid-west']
    const m = evaluateNeighborMove(world, mw, uy, world.resolveStand(mw))

    expect(m.result.stand.x).not.toBeCloseTo(drivewayStand.x, 0)
    expect(barrierBlocksReach(m.result.stand, drivewayStand, world.ctx)).toBe(
      true,
    )
    expect(
      isLandmarkReachable(uy, m.result.stand, world.ctx, world.size),
    ).toBe(false)
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

  it('allows reachability through an authored fence opening', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 0, y: 40 }
    const ctx = {
      barriers: [{ a: { x: -20, y: 20 }, b: { x: 20, y: 20 }, kind: 'fence' }],
      openings: [{ kind: 'hole', x: 0, y: 20, r: 12 }],
    }
    expect(barrierBlocksReach(from, to, ctx)).toBe(false)
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

    const mw = world.hexById['mid-west']
    const bankArrival = evaluateNeighborMove(
      world,
      mw,
      uy,
      world.resolveStand(mw),
    ).result.stand
    outdoor.state.stand = {
      x: Math.round(bankArrival.x),
      y: Math.round(bankArrival.y),
    }
    expect(outdoor.atBuildingEntrance).toBe(false)
  })
})
