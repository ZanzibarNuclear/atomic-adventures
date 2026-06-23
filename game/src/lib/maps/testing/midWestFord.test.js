import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { standAcrossOpening } from '../composables/usePassageCrossing.js'
import { firstBlockedOnPath } from '../composables/useTravelBarriers.js'
import {
  BARRIER_STAND_INSET,
  distToBarrierKind,
} from '../composables/useBarrierStand.js'
import { gameplayMoveTo } from './gameplayTravel.js'
import { isWestOfRiverAt, isEastOfRiverAt } from './riverSide.js'

describe('mid-west ford and bank column return', () => {
  const world = buildTravelWorld(mapData)
  world.revealOpening('mid-west-ford')
  const ford = world.ctx.openings.find((o) => o.id === 'mid-west-ford')
  const mw = world.hexById['mid-west']
  const uy = world.hexById['utility-yard']

  function westBankAtMidWest() {
    return {
      x: ford.x - world.size * 0.5,
      y: ford.y,
    }
  }

  it('crosses ford in one click from the west bank', () => {
    const fromPos = westBankAtMidWest()
    expect(isWestOfRiverAt(fromPos, world.ctx.barriers)).toBe(true)

    const cross = standAcrossOpening(ford, fromPos, world.ctx, world.size)
    expect(isEastOfRiverAt(cross, world.ctx.barriers)).toBe(true)
    expect(isWestOfRiverAt(cross, world.ctx.barriers)).toBe(false)
  })

  it('arrives safely on the west side and offers the ford after searching', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'upper-gorge'
    outdoor.state.stand = outdoor.defaultStandForHex('upper-gorge')

    outdoor.crossPassage('upper-gorge-bridge')
    gameplayMoveTo(outdoor, 'north-west')
    gameplayMoveTo(outdoor, 'mid-west')

    expect(outdoor.state.currentId).toBe('mid-west')
    expect(isWestOfRiverAt(outdoor.state.stand, outdoor.rivers)).toBe(true)
    expect(
      distToBarrierKind(outdoor.state.stand, 'river', outdoor.rivers),
    ).toBeGreaterThanOrEqual(BARRIER_STAND_INSET.river)
    expect(outdoor.canSearchHere()).toBe(true)

    outdoor.searchBarrier()

    expect(outdoor.state.discoveredOpenings).toContain('mid-west-ford')
    expect(outdoor.passageCrossings.map((crossing) => crossing.openingId)).toContain(
      'mid-west-ford',
    )
  })

  it('round-trips utility-yard after a single ford crossing', async () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'mid-west'
    outdoor.state.stand = westBankAtMidWest()
    outdoor.state.discoveredOpenings = ['mid-west-ford']

    outdoor.crossPassage('mid-west-ford')
    expect(isEastOfRiverAt(outdoor.state.stand, outdoor.rivers)).toBe(true)

    outdoor.moveTo('utility-yard')
    await new Promise((r) => setTimeout(r, 700))
    expect(outdoor.state.currentId).toBe('utility-yard')
    expect(isEastOfRiverAt(outdoor.state.stand, outdoor.rivers)).toBe(true)

    expect(outdoor.directMoves.map((m) => m.toHexId)).toContain('mid-west')

    outdoor.moveTo('mid-west')
    await new Promise((r) => setTimeout(r, 700))
    expect(outdoor.state.currentId).toBe('mid-west')
    expect(isEastOfRiverAt(outdoor.state.stand, outdoor.rivers)).toBe(true)
  })

  it('adjacent utility-yard movement does not require a ford', () => {
    const fromMw = westBankAtMidWest()
    const toUy = evaluateNeighborMove(world, mw, uy, fromMw)
    const back = evaluateNeighborMove(world, uy, mw, toUy.result.stand)

    expect(toUy.reachable).toBe(true)
    expect(back.offerable).toBe(true)
    expect(back.reachable).toBe(true)
  })

  it('enters gate-woods south of the fence after crossing the ford', async () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'upper-gorge'
    outdoor.state.stand = outdoor.defaultStandForHex('upper-gorge')
    outdoor.state.discoveredOpenings = ['mid-west-ford']

    outdoor.crossPassage('upper-gorge-bridge')
    outdoor.moveTo('north-west')
    await new Promise((r) => setTimeout(r, 700))
    outdoor.moveTo('mid-west')
    await new Promise((r) => setTimeout(r, 700))
    outdoor.crossPassage('mid-west-ford')
    const beforeGate = { ...outdoor.state.stand }

    outdoor.moveTo('gate-woods')
    await new Promise((r) => setTimeout(r, 700))

    const closedBarriers = { barriers: outdoor.travelBarrierCtx.barriers, openings: [] }
    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.atBarrier).toBe('fence')
    expect(outdoor.state.stand.y).toBeGreaterThan(-61)
    expect(firstBlockedOnPath([beforeGate, outdoor.state.stand], closedBarriers)).toBeNull()
  })
})
