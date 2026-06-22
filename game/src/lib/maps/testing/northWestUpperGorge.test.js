import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildGameplayWorld, gameplayMoveTo } from './gameplayTravel.js'

/** Round-trip: northeast to upper-gorge, bridge to west bank, southwest to north-west. */
function atNorthWestFromUpperGorgeSouthwest(outdoor) {
  for (const h of ['east-pines', 'center-pines', 'north-bend', 'gate-woods', 'north-west']) {
    gameplayMoveTo(outdoor, h)
  }
  gameplayMoveTo(outdoor, 'upper-gorge')
  outdoor.crossPassage('upper-gorge-bridge')
  gameplayMoveTo(outdoor, 'north-west')
  expect(outdoor.state.currentId).toBe('north-west')
}

describe('north-west to upper-gorge after southwest arrival', () => {
  it('offers go northeast after walking southwest from upper-gorge (west bank)', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    atNorthWestFromUpperGorgeSouthwest(outdoor)

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
