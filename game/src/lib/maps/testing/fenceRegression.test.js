import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import {
  buildTravelWorld,
  evaluateNeighborMove,
  enumerateDefaultStandMoves,
} from './travelWorld.js'
import { firstBlockedOnPath } from '../composables/useTravelBarriers.js'

const world = buildTravelWorld(mapData)

describe('fence regression sweep', () => {
  it('lists fence hits that are reachable without a gate opening', () => {
    const bad = []
    for (const move of enumerateDefaultStandMoves(world)) {
      if (move.hit?.kind !== 'fence') continue
      if (move.reachable) {
        bad.push(`${move.fromHex.id} → ${move.toHex.id}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('lists moves where path hits fence but resolveMove does not block', () => {
    const bad = []
    for (const move of enumerateDefaultStandMoves(world)) {
      const fullHit = firstBlockedOnPath(move.path, world.ctx)
      if (fullHit?.kind !== 'fence') continue
      if (!move.result.blockedKind) {
        bad.push({
          leg: `${move.fromHex.id} → ${move.toHex.id}`,
          fullHit,
          result: move.result,
        })
      }
    }
    expect(bad).toEqual([])
  })

  it('gate-woods to north-west should not fully cross compound fence', () => {
    const from = world.hexById['gate-woods']
    const to = world.hexById['north-west']
    const m = evaluateNeighborMove(world, from, to, world.resolveStand(from))
    expect(m.reachable, JSON.stringify(m)).toBe(false)
  })

  it('north-west to mid-west parallel bank: stays on north-west at fence', () => {
    const from = world.hexById['north-west']
    const to = world.hexById['mid-west']
    const m = evaluateNeighborMove(world, from, to, world.resolveStand(from))
    expect(m.result.activeHexId).toBe('north-west')
    expect(m.result.blockedKind).toBe('fence')
    expect(m.reachable).toBe(false)
    expect(m.enters).toBe(false)
  })
})
