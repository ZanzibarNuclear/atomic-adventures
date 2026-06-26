import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import {
  buildGameplayWorld,
  gameplayMoveTo,
  GATE_FLAG_PASSED,
} from './gameplayTravel.js'
import { distToBarrierKind } from '../composables/useBarrierStand.js'

/**
 * Gameplay smoke: locked compound gate with real moveTo + gameState.
 * Geometry-only tests (buildTravelWorld) leave the gate open and miss these paths.
 */
describe('compound gate gameplay', () => {
  const FENCE_X = 84.32
  const NORTH_FENCE_Y = -128
  const GATE_APPROACH = { x: 33, y: -142 }

  function walkToRoadFork(outdoor) {
    for (const h of ['east-pines', 'center-pines', 'north-bend', 'road-fork']) {
      gameplayMoveTo(outdoor, h)
    }
  }

  function atGateApproach(outdoor) {
    for (const h of ['east-pines', 'center-pines', 'north-bend', 'gate-woods']) {
      gameplayMoveTo(outdoor, h)
    }
  }

  it('enters north-bend outside the compound fence when walking from center-pines', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    gameplayMoveTo(outdoor, 'east-pines')
    gameplayMoveTo(outdoor, 'center-pines')
    gameplayMoveTo(outdoor, 'north-bend')

    expect(outdoor.state.currentId).toBe('north-bend')
    expect(outdoor.state.stand.x).toBeGreaterThan(FENCE_X)
  })

  it('road-fork south lands north of the locked gate, not inside the fence', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    walkToRoadFork(outdoor)
    gameplayMoveTo(outdoor, 'gate-woods')

    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand).toEqual(GATE_APPROACH)
    expect(outdoor.state.stand.y).toBeLessThan(NORTH_FENCE_Y)
    expect(outdoor.state.atBarrier).not.toBe('fence')
    expect(outdoor.state.lastBlocked).toBeNull()
  })

  it('north-bend → gate-woods follows the compound road to the gate approach', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    gameplayMoveTo(outdoor, 'east-pines')
    gameplayMoveTo(outdoor, 'center-pines')
    gameplayMoveTo(outdoor, 'north-bend')
    expect(outdoor.state.stand.x).toBeGreaterThan(FENCE_X)

    gameplayMoveTo(outdoor, 'gate-woods')
    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand).toEqual(GATE_APPROACH)
  })

  it('offers gate opening before gate passage or south moves', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    atGateApproach(outdoor)

    expect(outdoor.passageToggleActions.map((action) => action.label)).toContain('Open the gate')
    expect(outdoor.lockedPassageActions).toEqual([])
    expect(outdoor.passageCrossings.map((crossing) => crossing.label)).not.toContain('Go through the gate')
    expect(outdoor.canReachHex('west-slope')).toBe(false)
    expect(outdoor.directMoves.map((move) => move.label)).toContain('east')
    expect(outdoor.passageCrossings.map((c) => c.openingId)).not.toContain(
      'compound-gate',
    )
  })

  it('opens and closes the gate passage from the gate approach', () => {
    const { outdoor, gameState } = buildGameplayWorld(mapData)
    atGateApproach(outdoor)

    outdoor.togglePassage('compound-gate')
    expect(outdoor.passageCrossings.map((crossing) => crossing.label)).toContain('Go through the gate')
    expect(outdoor.passageToggleActions.map((action) => action.label)).toContain('Close the gate')
    expect(outdoor.canReachHex('west-slope')).toBe(false)

    outdoor.crossPassage('compound-gate')
    expect(gameState.flags.has(GATE_FLAG_PASSED)).toBe(true)

    expect(outdoor.canReachHex('west-slope')).toBe(true)

    outdoor.togglePassage('compound-gate')
    expect(outdoor.passageToggleActions.map((action) => action.label)).toContain('Open the gate')
    expect(outdoor.passageCrossings.map((crossing) => crossing.label)).not.toContain('Go through the gate')
  })

  it('treats explicit passage state as open until the player closes the gate', () => {
    const { outdoor } = buildGameplayWorld(mapData, {
      flags: [GATE_FLAG_PASSED],
    })
    outdoor.state.currentId = 'gate-woods'
    outdoor.state.stand = { ...GATE_APPROACH }
    outdoor.state.passageStates['compound-gate'] = true
    outdoor.crossPassage('compound-gate')

    expect(outdoor.lockedPassageActions).toEqual([])
    expect(outdoor.canReachHex('west-slope')).toBe(true)

    outdoor.togglePassage('compound-gate')
    expect(outdoor.state.passageStates['compound-gate']).toBe(false)
    expect(outdoor.passageCrossings.map((crossing) => crossing.openingId)).not.toContain('compound-gate')
  })
})
