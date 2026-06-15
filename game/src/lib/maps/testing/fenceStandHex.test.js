import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'

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

  it('north-west → mid-west', () => {
    const world = buildTravelWorld(mapData)
    const m = evaluateNeighborMove(
      world,
      world.hexById['north-west'],
      world.hexById['mid-west'],
      world.resolveStand(world.hexById['north-west']),
    )
    expect({
      activeHexId: m.result.activeHexId,
      blockedKind: m.result.blockedKind,
      offerable: m.offerable,
      enters: m.enters,
    }).toMatchInlineSnapshot(`
      {
        "activeHexId": "north-west",
        "blockedKind": "fence",
        "enters": false,
        "offerable": false,
      }
    `)
  })
})
