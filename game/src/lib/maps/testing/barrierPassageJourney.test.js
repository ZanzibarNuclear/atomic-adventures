import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import {
  buildTravelWorld,
  evaluateNeighborMove,
} from './travelWorld.js'

/**
 * End-to-end smoke: trailhead → … → upper-gorge, bridge to north-west,
 * mid-west, search ford, cross to west-slope, reach utility-yard.
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
    const m = evaluateNeighborMove(world, fromHex, toHex, pos)
    return m
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

  it('crosses bridge at upper-gorge to north-west, ford at mid-west to utility-yard', () => {
    const world = buildTravelWorld(mapData)

    // Arrive at upper-gorge
    let fromId = 'trailhead'
    let fromPos = world.resolveStand(world.hexById[fromId])
    for (const toId of APPROACH.slice(1)) {
      const m = walk(world, fromId, toId, fromPos)
      expectReachable({ ...m, toHex: world.hexById[toId] }, `${fromId} → ${toId}`)
      fromId = toId
      fromPos = m.result.stand
    }

    // Cross bridge to north-west, then follow compound interior to mid-west
    // (fence-run-west blocks a direct north-west → mid-west chord).
    let m = walk(world, 'upper-gorge', 'north-west', fromPos)
    expect(m.reachable, 'upper-gorge → north-west via bridge').toBe(true)
    fromPos = m.result.stand

    m = walk(world, 'north-west', 'gate-woods', fromPos)
    expectReachable({ ...m, toHex: world.hexById['gate-woods'] }, 'north-west → gate-woods')
    fromPos = m.result.stand

    m = walk(world, 'gate-woods', 'mid-west', fromPos)
    expectReachable({ ...m, toHex: world.hexById['mid-west'] }, 'gate-woods → mid-west')
    fromPos = m.result.stand
    fromId = 'mid-west'

    // Search reveals the hidden ford, then continue to the station.
    world.searchInHex('mid-west')

    m = walk(world, fromId, 'utility-yard', fromPos)
    expectReachable({ ...m, toHex: world.hexById['utility-yard'] }, 'mid-west → utility-yard')
  })
})
