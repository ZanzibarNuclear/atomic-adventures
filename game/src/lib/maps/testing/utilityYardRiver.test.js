import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import {
  buildTravelWorld,
  evaluateNeighborMove,
  enumerateDefaultStandMoves,
  enumerateBarrierStandMoves,
} from './travelWorld.js'

const world = buildTravelWorld(mapData)

describe('river blocks to utility-yard', () => {
  it('lists default-stand moves blocked by river toward utility-yard', () => {
    const blocked = []
    for (const move of enumerateDefaultStandMoves(world)) {
      if (move.toHex.id !== 'utility-yard') continue
      if (move.result.blockedKind === 'river' || move.hit?.kind === 'river') {
        blocked.push({
          from: move.fromHex.id,
          offerable: move.offerable,
          reachable: move.reachable,
          blockedKind: move.result.blockedKind,
          hit: move.hit,
        })
      }
    }
    expect(blocked).toEqual([])
  })

  it('lists all non-reachable default moves to utility-yard', () => {
    const bad = []
    for (const move of enumerateDefaultStandMoves(world)) {
      if (move.toHex.id !== 'utility-yard') continue
      if (!move.reachable) {
        bad.push({
          from: move.fromHex.id,
          offerable: move.offerable,
          blockedKind: move.result.blockedKind,
          hitKind: move.hit?.kind,
        })
      }
    }
    expect(bad).toEqual([])
  })
})
