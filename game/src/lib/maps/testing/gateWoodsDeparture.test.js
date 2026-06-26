import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import { buildGameplayWorld, gameplayMoveTo, offeredDestinations } from './gameplayTravel.js'

describe('gate-woods departure', () => {
  const NORTH_FENCE_Y = -128
  const GATE_APPROACH = { x: 33, y: -142 }

  function atGateApproach(outdoor) {
    for (const h of ['east-pines', 'center-pines', 'north-bend', 'gate-woods']) {
      gameplayMoveTo(outdoor, h)
    }
    expect(outdoor.state.stand).toEqual(GATE_APPROACH)
  }

  it('north to road-fork stays north of the fence and locked gate', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    atGateApproach(outdoor)
    expect(outdoor.state.stand.y).toBeLessThan(NORTH_FENCE_Y)

    expect(offeredDestinations(outdoor)).toContain('road-fork')

    gameplayMoveTo(outdoor, 'road-fork')
    expect(outdoor.state.currentId).toBe('road-fork')
    expect(outdoor.state.stand.y).toBeLessThan(NORTH_FENCE_Y)
    expect(outdoor.state.lastBlocked).toBeNull()
  })

  it('northwest to lower-gorge walks straight from the gate approach', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    atGateApproach(outdoor)
    expect(outdoor.canReachHex('lower-gorge')).toBe(true)
    gameplayMoveTo(outdoor, 'lower-gorge')
    expect(outdoor.state.currentId).toBe('lower-gorge')
    expect(outdoor.state.atBarrier).not.toBe('fence')
    expect(outdoor.state.lastBlocked).toBeNull()
  })

  it('does not show a fence hint north of the compound at the gate approach', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    atGateApproach(outdoor)
    expect(outdoor.barrierHintAtStand()).toBeNull()
  })
})
