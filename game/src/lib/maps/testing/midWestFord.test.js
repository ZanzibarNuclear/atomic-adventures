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

describe('the-flats ford and bank column return', () => {
  const NORTH_FENCE_Y = -128

  const world = buildTravelWorld(mapData)
  world.revealOpening('the-flats-ford')
  const ford = world.ctx.openings.find((o) => o.id === 'the-flats-ford')
  const mw = world.hexById['the-flats']
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
    gameplayMoveTo(outdoor, 'lower-gorge')
    gameplayMoveTo(outdoor, 'the-flats')

    expect(outdoor.state.currentId).toBe('the-flats')
    expect(isWestOfRiverAt(outdoor.state.stand, outdoor.rivers)).toBe(true)
    expect(
      distToBarrierKind(outdoor.state.stand, 'river', outdoor.rivers),
    ).toBeGreaterThanOrEqual(BARRIER_STAND_INSET.river)
    expect(outdoor.canSearchHere()).toBe(true)

    outdoor.searchBarrier()

    expect(outdoor.state.discoveredOpenings).toContain('the-flats-ford')
    expect(outdoor.passageCrossings.map((crossing) => crossing.openingId)).toContain(
      'the-flats-ford',
    )
  })

  it('round-trips utility-yard after a single ford crossing', async () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'the-flats'
    outdoor.state.stand = westBankAtMidWest()
    outdoor.state.discoveredOpenings = ['the-flats-ford']

    outdoor.crossPassage('the-flats-ford')
    expect(isEastOfRiverAt(outdoor.state.stand, outdoor.rivers)).toBe(true)

    outdoor.moveTo('utility-yard')
    await new Promise((r) => setTimeout(r, 700))
    expect(outdoor.state.currentId).toBe('utility-yard')
    expect(isEastOfRiverAt(outdoor.state.stand, outdoor.rivers)).toBe(true)

    expect(outdoor.directMoves.map((m) => m.toHexId)).toContain('the-flats')

    outdoor.moveTo('the-flats')
    await new Promise((r) => setTimeout(r, 700))
    expect(outdoor.state.currentId).toBe('the-flats')
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
    outdoor.state.discoveredOpenings = ['the-flats-ford']

    outdoor.crossPassage('upper-gorge-bridge')
    outdoor.moveTo('lower-gorge')
    await new Promise((r) => setTimeout(r, 700))
    outdoor.moveTo('the-flats')
    await new Promise((r) => setTimeout(r, 700))
    outdoor.crossPassage('the-flats-ford')
    const beforeGate = { ...outdoor.state.stand }

    outdoor.moveTo('gate-woods')
    await new Promise((r) => setTimeout(r, 700))

    const closedBarriers = { barriers: outdoor.travelBarrierCtx.barriers, openings: [] }
    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.atBarrier).toBe('fence')
    expect(outdoor.state.stand.y).toBeGreaterThan(NORTH_FENCE_Y)
    expect(firstBlockedOnPath([beforeGate, outdoor.state.stand], closedBarriers)).toBeNull()
  })
})
