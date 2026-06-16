import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove, offeredMoves } from './travelWorld.js'
import { chordCrossesBarrierKind } from '../composables/useTravelBarriers.js'
import { getMovementOptions } from '../../../composables/usePlayPanel.js'

describe('upper-gorge crossing UI', () => {
  const world = buildTravelWorld(mapData)

  it('arrives on east bank standAt, not drive endpoint', () => {
    const rf = world.hexById['road-fork']
    const ug = world.hexById['upper-gorge']
    const m = evaluateNeighborMove(world, rf, ug, world.resolveStand(rf))
    const bank = world.resolveStand(ug)

    expect(m.result.activeHexId).toBe('upper-gorge')
    expect(m.result.stand.x).toBeCloseTo(bank.x, 4)
    expect(m.result.stand.y).toBeCloseTo(bank.y, 4)
  })

  it('north-west chord crosses the river from east bank', () => {
    const ug = world.hexById['upper-gorge']
    const stand = world.resolveStand(ug)
    const nw = world.resolveStand(world.hexById['north-west'])
    expect(chordCrossesBarrierKind(stand, nw, 'river', world.ctx)).toBe(true)
  })

  it('dedupes bridge crossing ahead of plain northwest direct move', () => {
    const ug = world.hexById['upper-gorge']
    const stand = world.resolveStand(ug)
    const { routeMoves, directMoves } = offeredMoves(world, ug, stand)
    const options = getMovementOptions(
      {
        moves: routeMoves,
        directMoves,
        crossingMoves: [
          {
            toHexId: 'north-west',
            label: 'Cross the bridge — Go northwest',
            kind: 'river',
          },
        ],
        state: { atBarrier: null, lastBlocked: null },
        isAdjacentHex: () => true,
        canSearchHere: () => false,
      },
      null,
    )

    const bridge = options.find((o) => o.toHexId === 'north-west')
    expect(bridge?.label).toMatch(/Cross the bridge/)
    expect(options.filter((o) => o.toHexId === 'north-west')).toHaveLength(1)
  })
})
