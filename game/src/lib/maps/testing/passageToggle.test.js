import { describe, it, expect } from 'vitest'
import { mapData } from '../../testing/content.js'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'

describe('passage crossing toggle', () => {
  const outdoor = useOutdoorWorld(mapData)

  function movementDests() {
    return outdoor.directMoves.map((move) => move.toHexId)
  }

  it('refreshes travel options and allows crossing back after bridge toggle', () => {
    outdoor.resetPlayer()
    outdoor.state.currentId = 'upper-gorge'
    outdoor.state.stand = outdoor.defaultStandForHex('upper-gorge')
    outdoor.state.atBarrier = null
    outdoor.state.lastBlocked = null

    const eastDests = new Set(movementDests())
    expect(eastDests.has('north-west')).toBe(true)
    expect(outdoor.passageCrossings.some((c) => c.openingId === 'upper-gorge-bridge')).toBe(
      true,
    )

    outdoor.crossPassage('upper-gorge-bridge')

    const westDests = movementDests()
    expect(outdoor.state.currentId).toBe('upper-gorge')
    expect(outdoor.passageCrossings.some((c) => c.openingId === 'upper-gorge-bridge')).toBe(
      true,
    )
    expect(westDests).toContain('north-west')

    outdoor.crossPassage('upper-gorge-bridge')

    expect(outdoor.passageCrossings.some((c) => c.openingId === 'upper-gorge-bridge')).toBe(
      true,
    )
    expect(new Set(movementDests())).toEqual(eastDests)
  })
})
