import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import { buildOutdoorStatusLines } from '../../../composables/usePlayPanel.js'

const indoor = { building: { label: 'Utility Station' } }

describe('outdoor barrier status lines', () => {
  it('utility-yard → south-pines does not claim river bank', async () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'utility-yard'
    outdoor.state.stand = outdoor.defaultStandForHex('utility-yard')
    outdoor.moveTo('south-pines')
    await new Promise((r) => setTimeout(r, 700))

    const lines = buildOutdoorStatusLines(outdoor, indoor)
    expect(lines.some((l) => l.includes('river bank'))).toBe(false)
    expect(outdoor.state.atBarrier).not.toBe('river')
  })

  it('move to lower-stand clears stale river status', async () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'south-pines'
    outdoor.state.stand = outdoor.defaultStandForHex('south-pines')
    outdoor.state.discoveredOpenings = ['south-pines-hole']
    outdoor.state.atBarrier = 'river'

    outdoor.moveTo('lower-stand')
    await new Promise((r) => setTimeout(r, 700))

    expect(outdoor.state.currentId).toBe('lower-stand')
    expect(outdoor.state.atBarrier).not.toBe('river')
    const lines = buildOutdoorStatusLines(outdoor, indoor)
    expect(lines.some((l) => l.includes('river bank'))).toBe(false)
  })

  it('road-fork → upper-gorge still reports river bank at the drive end', async () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'road-fork'
    outdoor.state.stand = { x: -76, y: -132 }
    outdoor.moveTo('upper-gorge')
    await new Promise((r) => setTimeout(r, 700))

    const lines = buildOutdoorStatusLines(outdoor, indoor)
    expect(lines).toContain('The river bank is here.')
    expect(outdoor.state.atBarrier).toBe('river')
  })
})
