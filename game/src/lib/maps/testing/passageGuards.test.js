import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import { buildOutdoorPlayActions } from '../../../composables/usePlayPanel.js'
import { buildGameplayWorld, gameplayMoveTo } from './gameplayTravel.js'

describe('passage crossing guards', () => {
  function standInsideOpenCompoundGate() {
    const { outdoor } = buildGameplayWorld(mapData, {
      flags: ['story.gate.inspected', 'story.gate.untangled'],
    })
    for (const hexId of ['east-pines', 'center-pines', 'north-bend', 'gate-woods']) {
      gameplayMoveTo(outdoor, hexId)
    }
    outdoor.togglePassage('compound-gate')
    outdoor.crossPassage('compound-gate')
    return outdoor
  }

  it('does not cross a locked gate through a direct call', () => {
    const { outdoor } = buildGameplayWorld(mapData, {
      startHex: 'gate-woods',
    })
    outdoor.state.stand = { x: -81, y: -76 }

    outdoor.crossPassage('compound-gate')

    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand).toEqual({ x: -81, y: -76 })
    expect(outdoor.state.passageStates['compound-gate']).toBeUndefined()
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
    })
    outdoor.state.passageStates['compound-gate'] = true
    outdoor.state.stand = { x: -81, y: -20 }
    outdoor.state.atBarrier = 'fence'

    outdoor.crossPassage('compound-gate')

    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand).toEqual({ x: -81, y: -20 })
  })

  it('lets the authored road route leave through an open gate but not a closed gate', () => {
    const open = standInsideOpenCompoundGate()
    expect(open.canReachHex('road-fork')).toBe(true)
    expect(buildOutdoorPlayActions(open).map((action) => action.id)).toContain('route:road-fork')

    gameplayMoveTo(open, 'road-fork')
    expect(open.state.currentId).toBe('road-fork')

    const closed = standInsideOpenCompoundGate()
    closed.togglePassage('compound-gate')
    expect(closed.canReachHex('road-fork')).toBe(false)
    expect(buildOutdoorPlayActions(closed).map((action) => action.id)).not.toContain('route:road-fork')
  })
})
