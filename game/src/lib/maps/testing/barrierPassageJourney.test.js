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
 * Smoke: northern approach → bridge → west-bank column → ford search.
 * Gate and hole are covered in companion tests in this file.
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

  it('crosses bridge then walks west-bank column to utility-yard', () => {
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

    let m = walk(world, 'upper-gorge', 'north-west', fromPos)
    expectReachable({ ...m, toHex: world.hexById['north-west'] }, 'upper-gorge → north-west after bridge')
    fromPos = m.result.stand

    const blockedFromCenter = walk(
      world,
      'north-west',
      'mid-west',
      world.resolveStand(world.hexById['north-west']),
    )
    expect(blockedFromCenter.reachable, 'hex-center NW→MW blocked by river').toBe(false)

    m = walk(world, 'north-west', 'mid-west', fromPos)
    expectReachable({ ...m, toHex: world.hexById['mid-west'] }, 'west bank NW→MW')
    fromPos = m.result.stand

    const fordBefore = availablePassageCrossings({
      hexId: 'mid-west',
      fromPos,
      mapFeatures: mapData.features,
      ctx: world.ctx,
      hexById: world.hexById,
      size: world.size,
    })
    expect(fordBefore.some((c) => c.openingId === 'mid-west-ford')).toBe(false)

    expect(world.searchInHex('mid-west')).toContain('mid-west-ford')

    m = walk(world, 'mid-west', 'utility-yard', fromPos)
    expectReachable({ ...m, toHex: world.hexById['utility-yard'] }, 'mid-west → utility-yard')
  })

  it('compound gate allows gate-woods → south-pines', () => {
    const world = buildTravelWorld(mapData)
    const m = walk(
      world,
      'gate-woods',
      'south-pines',
      world.resolveStand(world.hexById['gate-woods']),
    )
    expectReachable({ ...m, toHex: world.hexById['south-pines'] }, 'gate-woods → south-pines')
  })

  it('south-pines hole requires search before lower-stand crossing', () => {
    const world = buildTravelWorld(mapData)
    const from = world.hexById['lower-stand']
    const to = world.hexById['south-pines']
    const blocked = walk(world, from.id, to.id, world.resolveStand(from))
    expect(blocked.reachable).toBe(false)

    world.revealOpening('south-pines-hole')
    const open = walk(world, from.id, to.id, world.resolveStand(from))
    expectReachable({ ...open, toHex: to }, 'lower-stand → south-pines after hole')
  })
})
