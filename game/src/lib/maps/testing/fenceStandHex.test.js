import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { hexCenterStand } from '../composables/useAvatarStand.js'

describe('stand hex after fence block', () => {
  it('lower-stand → south-pines', () => {
    const world = buildTravelWorld(mapData)
    const m = evaluateNeighborMove(
      world,
      world.hexById['lower-stand'],
      world.hexById['south-pines'],
      world.resolveStand(world.hexById['lower-stand']),
    )
    expect({
      activeHexId: m.result.activeHexId,
      blockedKind: m.result.blockedKind,
      stand: m.result.stand,
      offerable: m.offerable,
      enters: m.enters,
    }).toMatchInlineSnapshot(`
      {
        "activeHexId": "south-pines",
        "blockedKind": "fence",
        "enters": true,
        "offerable": true,
        "stand": {
          "x": -24.999999999999993,
          "y": 66,
        },
      }
    `)
  })

  it('north-west → mid-west from hex center', () => {
    const world = buildTravelWorld(mapData)
    const from = world.hexById['north-west']
    const to = world.hexById['mid-west']
    const fromPos = hexCenterStand(from, world.size)
    const m = evaluateNeighborMove(world, from, to, fromPos)
    expect({
      activeHexId: m.result.activeHexId,
      blockedKind: m.result.blockedKind,
      offerable: m.offerable,
      enters: m.enters,
      reachable: m.reachable,
    }).toEqual({
      activeHexId: 'mid-west',
      blockedKind: null,
      offerable: true,
      enters: true,
      reachable: true,
    })
  })
})
