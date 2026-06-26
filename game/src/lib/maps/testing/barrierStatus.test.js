import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
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
    outdoor.crossPassage('south-pines-hole')

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
    outdoor.state.stand = outdoor.defaultStandForHex('road-fork')
    outdoor.moveTo('upper-gorge')
    await new Promise((r) => setTimeout(r, 700))

    const lines = buildOutdoorStatusLines(outdoor, indoor)
    expect(lines).toContain('The river bank is here.')
    expect(outdoor.state.atBarrier).toBe('river')
  })

  it('describes a normal fence stretch when inspection finds nothing hidden', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'center-pines'
    outdoor.state.stand = outdoor.defaultStandForHex('center-pines')

    expect(outdoor.searchBarrier()).toEqual([])

    const lines = buildOutdoorStatusLines(outdoor, indoor)
    expect(lines).toContain('You see a sturdy fence covered in ivy.')
  })

  it('reports a hole found during fence inspection', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'south-pines'
    outdoor.state.stand = outdoor.defaultStandForHex('south-pines')

    expect(outdoor.searchBarrier()).toContain('south-pines-hole')

    const lines = buildOutdoorStatusLines(outdoor, indoor)
    expect(lines).toContain('On closer inspection, you have found a hole in the fence.')
  })
})
