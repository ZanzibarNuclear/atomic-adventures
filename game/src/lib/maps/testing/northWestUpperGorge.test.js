import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import { buildGameplayWorld, gameplayMoveTo } from './gameplayTravel.js'

/** Round-trip: northeast to upper-gorge, bridge to west bank, southwest to lower-gorge. */
function atLowerGorgeFromUpperGorgeSouthwest(outdoor) {
  for (const h of ['east-pines', 'center-pines', 'north-bend', 'gate-woods', 'lower-gorge']) {
    gameplayMoveTo(outdoor, h)
  }
  gameplayMoveTo(outdoor, 'upper-gorge')
  outdoor.crossPassage('upper-gorge-bridge')
  gameplayMoveTo(outdoor, 'lower-gorge')
  expect(outdoor.state.currentId).toBe('lower-gorge')
}

describe('lower-gorge to upper-gorge after southwest arrival', () => {
  it('offers go northeast after walking southwest from upper-gorge (west bank)', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    atLowerGorgeFromUpperGorgeSouthwest(outdoor)

    expect(outdoor.canReachHex('upper-gorge')).toBe(true)

    const upper = outdoor.directMoves.find((move) => move.toHexId === 'upper-gorge')
    expect(
      upper,
      `expected upper-gorge in ${outdoor.directMoves.map((o) => `${o.label} (${o.toHexId})`).join(', ')}`,
    ).toBeTruthy()
    expect(upper.label.toLowerCase()).toMatch(/northeast/)

    expect(outdoor.directMoves?.map((m) => m.toHexId)).toContain('upper-gorge')

    gameplayMoveTo(outdoor, 'upper-gorge')
    expect(outdoor.state.currentId).toBe('upper-gorge')
  })
})
