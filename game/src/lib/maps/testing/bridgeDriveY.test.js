import { describe, it, expect } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld } from './travelWorld.js'

describe('upper-gorge bridge placement', () => {
  it('sits north of the river-access drive terminus', () => {
    const world = buildTravelWorld(mapData)
    const drive = world.routeModels.find((r) => r.id === 'river-access-drive')
    const driveEndY = drive.points[drive.points.length - 1].y
    const bridge = mapData.features.find((f) => f.id === 'upper-gorge-bridge')
    expect(bridge.at.y).toBeLessThan(driveEndY)
  })
})
