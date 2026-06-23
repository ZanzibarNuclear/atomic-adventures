import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import { buildGameplayWorld, gameplayMoveTo, offeredDestinations } from './gameplayTravel.js'

describe('gate-woods departure', () => {
  function atGateApproach(outdoor) {
    for (const h of ['east-pines', 'center-pines', 'north-bend', 'gate-woods']) {
      gameplayMoveTo(outdoor, h)
    }
    expect(outdoor.state.stand).toEqual({ x: -81, y: -76 })
  }

  it('north to road-fork stays north of the fence and locked gate', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    atGateApproach(outdoor)
    expect(outdoor.state.stand.y).toBeLessThan(-62)

    expect(offeredDestinations(outdoor)).toContain('road-fork')

    gameplayMoveTo(outdoor, 'road-fork')
    expect(outdoor.state.currentId).toBe('road-fork')
    expect(outdoor.state.stand.y).toBeLessThan(-62)
    expect(outdoor.state.lastBlocked).toBeNull()
  })

  it('northwest to north-west walks straight from the gate approach', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    atGateApproach(outdoor)
    expect(outdoor.canReachHex('north-west')).toBe(true)
    gameplayMoveTo(outdoor, 'north-west')
    expect(outdoor.state.currentId).toBe('north-west')
    expect(outdoor.state.atBarrier).not.toBe('fence')
    expect(outdoor.state.lastBlocked).toBeNull()
  })

  it('does not show a fence hint north of the compound at the gate approach', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    atGateApproach(outdoor)
    expect(outdoor.barrierHintAtStand()).toBeNull()
  })
})
