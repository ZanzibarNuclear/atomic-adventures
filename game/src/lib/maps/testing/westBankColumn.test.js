import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import { hexCenterStand } from '../composables/useAvatarStand.js'
import { isWestOfRiverAt } from '../composables/usePassageCrossing.js'
import { getMovementOptions } from '../../../composables/usePlayPanel.js'
import {
  buildTravelWorld,
  evaluateNeighborMove,
  offeredMoves,
} from './travelWorld.js'
import { standAcrossOpening } from '../composables/usePassageCrossing.js'

describe('west bank column travel', () => {
  const world = buildTravelWorld(mapData)

  it('labels north-west southwest from upper-gorge west bank', () => {
    const ug = world.hexById['upper-gorge']
    const bridge = world.ctx.openings.find((o) => o.id === 'upper-gorge-bridge')
    const west = standAcrossOpening(
      bridge,
      world.resolveStand(ug),
      world.ctx,
      world.size,
    )
    const { directMoves } = offeredMoves(world, ug, west)
    expect(directMoves).toEqual([{ toHexId: 'north-west', label: 'southwest' }])
  })

  it('walks north-west → mid-west → utility-yard on the west bank', () => {
    const nw = world.hexById['north-west']
    const mw = world.hexById['mid-west']
    const uy = world.hexById['utility-yard']
    const fromNw = hexCenterStand(nw, world.size)

    const toMw = evaluateNeighborMove(world, nw, mw, fromNw)
    expect(toMw.reachable).toBe(true)
    expect(toMw.result.activeHexId).toBe('mid-west')
    expect(isWestOfRiverAt(toMw.result.stand, world.ctx.barriers)).toBe(true)

    const toUy = evaluateNeighborMove(world, mw, uy, toMw.result.stand)
    expect(toUy.reachable).toBe(true)
    expect(toUy.result.activeHexId).toBe('utility-yard')
    expect(isWestOfRiverAt(toUy.result.stand, world.ctx.barriers)).toBe(true)

    const backNw = evaluateNeighborMove(world, mw, nw, toMw.result.stand)
    expect(backNw.reachable).toBe(true)
    expect(backNw.result.activeHexId).toBe('north-west')
  })

  it('plays through bridge crossing and west-bank column in outdoor world', async () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'upper-gorge'
    outdoor.state.stand = outdoor.defaultStandForHex('upper-gorge')
    outdoor.crossPassage('upper-gorge-bridge')

    const westOpts = getMovementOptions(outdoor, null)
    expect(westOpts.find((o) => o.toHexId === 'north-west')?.label).toBe(
      'Go southwest',
    )

    outdoor.moveTo('north-west')
    await new Promise((r) => setTimeout(r, 700))
    expect(outdoor.state.currentId).toBe('north-west')

    outdoor.moveTo('mid-west')
    await new Promise((r) => setTimeout(r, 700))
    expect(outdoor.state.currentId).toBe('mid-west')

    outdoor.moveTo('utility-yard')
    await new Promise((r) => setTimeout(r, 700))
    expect(outdoor.state.currentId).toBe('utility-yard')
    expect(outdoor.state.lastBlocked).toBeNull()
  })
})
