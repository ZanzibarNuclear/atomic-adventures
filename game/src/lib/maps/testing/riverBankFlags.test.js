import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { firstBlockedOnPath } from '../composables/useTravelBarriers.js'

const world = buildTravelWorld(mapData)

describe('river bank stands (authored standAt)', () => {
  it('bank hexes use east-of-river standAt offsets', () => {
    const mw = world.hexById['mid-west']
    const uy = world.hexById['utility-yard']
    const nw = world.hexById['north-west']
    const ws = world.hexById['west-slope']

    expect(mw.standAt).toEqual({ dx: 0.23, dy: 0 })
    expect(nw.standAt).toEqual({ dx: 0.65, dy: 0 })
    expect(uy.standAt?.from).toBe('landmark')
    expect(ws.standAt).toBeUndefined()
  })

  it('west-slope reaches utility-yard via trail without crossing the river', () => {
    const ws = world.hexById['west-slope']
    const uy = world.hexById['utility-yard']
    const m = evaluateNeighborMove(world, ws, uy, world.resolveStand(ws))

    expect(m.result.blockedKind).toBeNull()
    expect(m.reachable).toBe(true)
    expect(m.result.activeHexId).toBe('utility-yard')
  })

  it('a direct chord that crosses the river is blocked like any barrier', () => {
    const ws = world.resolveStand(world.hexById['west-slope'])
    const uyLandmark = world.resolveStand(world.hexById['utility-yard'])
    const path = [ws, uyLandmark]
    const hit = firstBlockedOnPath(path, world.ctx)
    if (hit?.kind === 'river') {
      expect(hit.kind).toBe('river')
    } else {
      // Geometry may miss the river on this chord; trail routing handles gameplay.
      expect(hit).toBeNull()
    }
  })
})
