import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import { buildGameplayWorld, GATE_FLAG_UNLOCKED } from './gameplayTravel.js'

describe('passage crossing guards', () => {
  it('does not cross a locked gate through a direct call', () => {
    const { outdoor, gameState } = buildGameplayWorld(mapData, {
      startHex: 'gate-woods',
    })
    outdoor.state.stand = { x: -81, y: -76 }

    outdoor.crossPassage('compound-gate')

    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand).toEqual({ x: -81, y: -76 })
    expect(gameState.flags.has(GATE_FLAG_UNLOCKED)).toBe(false)
  })

  it('does not cross a hidden passage before discovery', () => {
    const { outdoor } = buildGameplayWorld(mapData, { startHex: 'south-pines' })
    outdoor.state.stand = { x: -18, y: 66 }
    outdoor.state.atBarrier = 'fence'

    outdoor.crossPassage('south-pines-hole')

    expect(outdoor.state.currentId).toBe('south-pines')
    expect(outdoor.state.stand).toEqual({ x: -18, y: 66 })
  })

  it('does not cross a passage from the wrong hex', () => {
    const { outdoor } = buildGameplayWorld(mapData, { startHex: 'center-pines' })
    outdoor.state.discoveredOpenings = ['south-pines-hole']
    outdoor.state.stand = outdoor.defaultStandForHex('center-pines')
    const before = { ...outdoor.state.stand }

    outdoor.crossPassage('south-pines-hole')

    expect(outdoor.state.currentId).toBe('center-pines')
    expect(outdoor.state.stand).toEqual(before)
  })

  it('does not trust stale atBarrier state when the avatar is not near the passage barrier', () => {
    const { outdoor } = buildGameplayWorld(mapData, {
      startHex: 'gate-woods',
      flags: [GATE_FLAG_UNLOCKED],
    })
    outdoor.state.stand = { x: -81, y: -20 }
    outdoor.state.atBarrier = 'fence'

    outdoor.crossPassage('compound-gate')

    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand).toEqual({ x: -81, y: -20 })
  })
})
