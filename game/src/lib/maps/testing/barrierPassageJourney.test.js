import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import {
  buildTravelWorld,
  evaluateNeighborMove,
} from './travelWorld.js'
import {
  availablePassageCrossings,
  standAcrossOpening,
} from '../composables/usePassageCrossing.js'

/**
 * Smoke: trailhead → … → upper-gorge, cross bridge in-hex, north-west → mid-west → ford
 */
describe('barrier passage journey smoke test', () => {
  const APPROACH = [
    'trailhead',
    'east-pines',
    'far-pines',
    'north-bend',
    'road-fork',
    'upper-gorge',
  ]

  function walk(world, fromId, toId, fromPos = null) {
    const fromHex = world.hexById[fromId]
    const toHex = world.hexById[toId]
    const pos = fromPos ?? world.resolveStand(fromHex)
    return evaluateNeighborMove(world, fromHex, toHex, pos)
  }

  function crossBridge(world, hexId, fromPos) {
    const crossings = availablePassageCrossings({
      hexId,
      fromPos,
      mapFeatures: mapData.features,
      ctx: world.ctx,
      hexById: world.hexById,
      size: world.size,
    })
    const bridge = crossings.find((c) => c.openingId === 'upper-gorge-bridge')
    expect(bridge, 'bridge crossing offered').toBeTruthy()
    const opening = world.ctx.openings.find((o) => o.id === bridge.openingId)
    const stand = standAcrossOpening(opening, fromPos, world.ctx, world.size)
    expect(world.hexAtPoint(stand, hexId), 'still in hex after crossing').toBe(
      hexId,
    )
    return stand
  }

  function expectReachable(m, label) {
    expect(m.reachable, label).toBe(true)
    expect(m.result.blockedKind, label).toBeNull()
    expect(m.result.activeHexId, label).toBe(m.toHex.id)
  }

  it('walks the northern approach to upper-gorge', () => {
    const world = buildTravelWorld(mapData)
    let fromId = APPROACH[0]
    let fromPos = world.resolveStand(world.hexById[fromId])

    for (let i = 1; i < APPROACH.length; i++) {
      const toId = APPROACH[i]
      const m = walk(world, fromId, toId, fromPos)
      expectReachable({ ...m, toHex: world.hexById[toId] }, `${fromId} → ${toId}`)
      fromId = toId
      fromPos = m.result.stand
    }
  })

  it('crosses bridge in-hex then continues to utility-yard', () => {
    const world = buildTravelWorld(mapData)

    let fromId = 'trailhead'
    let fromPos = world.resolveStand(world.hexById[fromId])
    for (const toId of APPROACH.slice(1)) {
      const m = walk(world, fromId, toId, fromPos)
      expectReachable({ ...m, toHex: world.hexById[toId] }, `${fromId} → ${toId}`)
      fromId = toId
      fromPos = m.result.stand
    }

    fromPos = crossBridge(world, 'upper-gorge', fromPos)

    let     m = walk(world, 'upper-gorge', 'north-west', fromPos)
    expectReachable({ ...m, toHex: world.hexById['north-west'] }, 'upper-gorge → north-west after bridge')
  })
})
