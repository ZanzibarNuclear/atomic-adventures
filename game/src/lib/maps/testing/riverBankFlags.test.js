import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { hexOnRiverBank, bankStandAt } from '../composables/useRiverBank.js'
import { firstBlockedOnPath } from '../composables/useTravelBarriers.js'

const world = buildTravelWorld(mapData)

describe('river bank flags', () => {
  it('utility-yard and mid-west river bank status', () => {
    const mw = world.hexById['mid-west']
    const uy = world.hexById['utility-yard']
    const nw = world.hexById['north-west']
    const ws = world.hexById['west-slope']

    expect(hexOnRiverBank(mw, world.size, world.rivers)).toBe(true)
    expect(hexOnRiverBank(uy, world.size, world.rivers)).toBe(true)
    expect(hexOnRiverBank(nw, world.size, world.rivers)).toBe(true)
    expect(hexOnRiverBank(ws, world.size, world.rivers)).toBe(false)

    expect(world.resolveStand(mw)).toEqual(bankStandAt(mw, world.size, world.rivers))
  })

  it('west-slope to utility-yard hits riverEntryBlock not path geometry', () => {
    const ws = world.hexById['west-slope']
    const uy = world.hexById['utility-yard']
    const fromPos = world.resolveStand(ws)
    const toPos = world.resolveStand(uy)
    const path = [fromPos, toPos]
    const m = evaluateNeighborMove(world, ws, uy, fromPos)

    expect(firstBlockedOnPath(path, world.ctx)).toBeNull()
    expect(m.result.blockedKind).toBe('river')
    expect(m.reachable).toBe(false)
  })
})
